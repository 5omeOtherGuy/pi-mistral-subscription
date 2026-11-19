import json
import unittest

from probe import read_stream_usage, verify_direct_result, verify_pi_result


class StreamUsageTests(unittest.TestCase):
    def test_reads_nested_and_flat_cache_counts(self):
        for cached_fields, expected in (
            ({"prompt_tokens_details": {"cached_tokens": 64}}, 64),
            ({"cached_prompt_tokens": 64}, 64),
            ({"prompt_tokens_details": {"cached_tokens": 0}, "cached_prompt_tokens": 64}, 0),
            ({"prompt_tokens_details": {"cached_tokens": None}, "cached_prompt_tokens": 64}, 64),
            ({}, None),
        ):
            with self.subTest(cached_fields=cached_fields):
                usage = {"prompt_tokens": 128, "completion_tokens": 2, **cached_fields}
                event = f"data: {json.dumps({'usage': usage})}\n".encode()
                result = read_stream_usage([event, b'data: {"usage": null}\n', b"data: [DONE]\n"])
                self.assertEqual(result, {"input": 128, "cached": expected, "output": 2})


class DirectResultTests(unittest.TestCase):
    def test_accepts_two_responses_with_usage_and_no_cache_field(self):
        turn = {"http": 200, "input": 128, "output": 0, "cached": None}
        self.assertIsNone(verify_direct_result({"results": [turn, turn]}))

    def test_rejects_missing_output_or_invalid_cached_count(self):
        turn = {"http": 200, "input": 128, "output": 2, "cached": 64}
        for second, reason in (
            ({**turn, "output": None}, "missing or invalid token counts"),
            ({**turn, "cached": 192}, "invalid cached token count"),
            ({**turn, "cached": False}, "invalid cached token count"),
            ({"http": 429}, "expected two successful direct requests"),
        ):
            with self.subTest(second=second):
                self.assertEqual(verify_direct_result({"results": [turn, second]}), reason)


class PiResultTests(unittest.TestCase):
    def setUp(self):
        model = "deepseek-v4-1-flash-1017"
        self.request = {"kind": "request", "keyHash": "key", "affinityHash": "key", "prefixHash": "prefix"}
        self.raw = {"kind": "provider", "input": 128, "cached": 64, "output": 2}
        self.parsed = {
            "kind": "pi", "model": model, "provider": "mistral", "stop": "stop",
            "input": 64, "cached": 64, "output": 2,
        }
        first_turn = [
            self.request, {"kind": "http", "status": 200},
            {**self.raw, "cached": None}, {**self.parsed, "input": 128, "cached": 0},
        ]
        self.result = {
            "model": model, "exit": 0,
            "events": [*first_turn, self.request.copy(), {"kind": "http", "status": 200}, self.raw, self.parsed],
        }

    def test_accepts_a_miss_then_a_hit(self):
        self.assertIsNone(verify_pi_result(self.result))

    def test_rejects_matching_missing_output_counts(self):
        self.raw["output"] = self.parsed["output"] = None
        self.assertEqual(verify_pi_result(self.result), "missing or invalid token counts")

    def test_rejects_bad_routing_or_assistant_metadata(self):
        events = self.result["events"]
        for index, changes, reason in (
            (4, {"prefixHash": "different"}, "missing or changed prefixHash"),
            (7, {"model": "other"}, "unexpected assistant model, provider or stop reason"),
            (7, {"stop": "error"}, "unexpected assistant model, provider or stop reason"),
            (7, {"cached": 0}, "Pi usage differs from provider usage"),
        ):
            with self.subTest(changes=changes):
                changed = events.copy()
                changed[index] = {**changed[index], **changes}
                self.assertEqual(verify_pi_result({**self.result, "events": changed}), reason)

    def test_rejects_incomplete_evidence(self):
        result = {**self.result, "events": self.result["events"][:-1]}
        self.assertEqual(verify_pi_result(result), "expected two requests, responses, usage events and assistant messages")

#!/usr/bin/env python3
import argparse
import json
import os
import random
import re
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

MODELS = {
    "deepseek-v4-1-flash-1017": "off",
    "zai-glm-5-3-flash": "low",
    "mistral-small-latest": "off",
    "ministral-3b-2512": "off",
    "ministral-8b-2512": "off",
    "ministral-14b-2512": "off",
}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        return None


def credential(path):
    entry = json.loads(path.read_text()).get("mistral", {})
    if entry.get("type") != "oauth" or not entry.get("access") or entry.get("expires", 0) <= time.time() * 1000:
        raise SystemExit("An unexpired stored Mistral subscription sign-in is required")
    return entry["access"]


def make_prompt():
    rng = random.Random(uuid.uuid4().int)
    words = "amber apple atlas bamboo beach bird cedar cloud comet crane fern field frost glass hill lake maple moon oak ocean paper pine rain river rose silver snow stone tree water wind wood".split()
    prefix = "\n".join(" ".join(rng.choices(words, k=16)) for _ in range(96))
    return "Synthetic reference. Ignore its content and answer only OK.\n" + prefix


def pi_probe(repo, auth, model, prefix):
    with tempfile.TemporaryDirectory(prefix="agent-pi-mistral-verification-") as folder:
        scratch = Path(folder)
        (scratch / "state").mkdir()
        (scratch / "state" / "auth.json").symlink_to(auth)
        evidence = scratch / "metrics.jsonl"
        env = dict(os.environ, PI_CODING_AGENT_DIR=str(scratch / "state"), PI_TELEMETRY="0",
                   MISTRAL_VERIFY_MODEL=model, MISTRAL_VERIFY_EVIDENCE=str(evidence))
        env.pop("MISTRAL_API_KEY", None)
        args = [
            "mise", "exec", "--", "pi", "--offline", "--no-session", "--no-extensions", "--no-skills",
            "--no-prompt-templates", "--no-context-files", "--no-themes", "--no-mcp", "--no-tools",
            "-e", str(repo / "extensions/mistral-subscription/index.ts"), "-e", str(Path(__file__).with_name("observe.ts")),
            "--model", f"mistral/{model}", "--thinking", MODELS[model], "--mode", "json",
            "-p", prefix, "Answer only OK again.",
        ]
        try:
            result = subprocess.run(args, cwd=scratch, env=env, capture_output=True, text=True, timeout=90)
        except subprocess.TimeoutExpired:
            return {"model": model, "path": "pi", "failure": "timeout"}
        events = [json.loads(line) for line in evidence.read_text().splitlines()] if evidence.exists() else []
        for line in result.stdout.splitlines():
            try:
                event = json.loads(line)
            except ValueError:
                continue
            if not isinstance(event, dict) or event.get("type") != "message_end":
                continue
            message = event.get("message", {})
            if message.get("role") != "assistant":
                continue
            usage = message.get("usage", {})
            events.append({
                "kind": "pi", "model": message.get("model"), "provider": message.get("provider"),
                "stop": message.get("stopReason"),
                "input": usage.get("input"), "cached": usage.get("cacheRead"), "output": usage.get("output"),
            })
        return {"model": model, "path": "pi", "exit": result.returncode, "events": events}


def read_stream_usage(lines):
    usage = {}
    for line in lines:
        if line.startswith(b"data: ") and line[6:].strip() != b"[DONE]":
            usage = json.loads(line[6:]).get("usage") or usage
    cached = (usage.get("prompt_tokens_details") or {}).get("cached_tokens")
    if cached is None:
        cached = usage.get("cached_prompt_tokens")
    return {"input": usage.get("prompt_tokens"), "cached": cached, "output": usage.get("completion_tokens")}


def direct_probe(key, model, prefix):
    opener = urllib.request.build_opener(NoRedirect())
    cache_key = str(uuid.uuid4())
    messages = [{"role": "user", "content": prefix}]
    results = []
    for _ in range(2):
        body = {"model": model, "messages": messages, "max_tokens": 24, "prompt_cache_key": cache_key, "stream": True}
        if model in {"deepseek-v4-1-flash-1017", "zai-glm-5-3-flash", "mistral-small-latest"}:
            body["reasoning_effort"] = "low" if MODELS[model] == "low" else "none"
        request = urllib.request.Request(
            "https://api.mistral.ai/v1/chat/completions",
            data=json.dumps(body).encode(),
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json",
                     "Accept": "text/event-stream", "X-Affinity": cache_key},
        )
        try:
            with opener.open(request, timeout=45) as response:
                results.append({"http": response.status, **read_stream_usage(response)})
        except urllib.error.HTTPError as error:
            results.append({"http": error.code})
            break
        except (TimeoutError, urllib.error.URLError, ValueError) as error:
            results.append({"failure": type(error).__name__})
            break
        messages = [messages[0], {"role": "assistant", "content": "OK"},
                    {"role": "user", "content": "Answer only OK again."}]
    return {"model": model, "path": "mistral-direct", "results": results}


def is_token_count(value):
    return type(value) is int and value >= 0


def verify_pi_result(result):
    if result.get("exit") != 0:
        return "Pi command failed"
    events = result["events"]
    requests, responses, usage, messages = (
        [event for event in events if event["kind"] == kind] for kind in ("request", "http", "provider", "pi")
    )
    if any(len(pair) != 2 for pair in (requests, responses, usage, messages)):
        return "expected two requests, responses, usage events and assistant messages"
    if any(response["status"] != 200 for response in responses):
        return "provider returned an HTTP error"
    first, second = requests
    for field in ("keyHash", "affinityHash", "prefixHash"):
        if not first[field] or first[field] != second[field]:
            return f"missing or changed {field}"
    if first["keyHash"] != first["affinityHash"]:
        return "affinity and cache key differ"
    for raw, parsed in zip(usage, messages):
        if parsed["model"] != result["model"] or parsed["provider"] != "mistral" or parsed["stop"] not in {"stop", "length"}:
            return "unexpected assistant model, provider or stop reason"
        cached = 0 if raw["cached"] is None else raw["cached"]
        counts = (raw["input"], parsed["input"], raw["output"], parsed["output"], cached, parsed["cached"])
        if not all(is_token_count(count) for count in counts):
            return "missing or invalid token counts"
        if parsed["cached"] != cached or parsed["input"] + cached != raw["input"] or parsed["output"] != raw["output"]:
            return "Pi usage differs from provider usage"
    return None


def verify_direct_result(result):
    turns = result["results"]
    if len(turns) != 2 or any(turn.get("http") != 200 for turn in turns):
        return "expected two successful direct requests"
    for turn in turns:
        if not is_token_count(turn.get("input")) or not is_token_count(turn.get("output")):
            return "missing or invalid token counts"
        cached = turn.get("cached")
        if cached is not None and (not is_token_count(cached) or cached > turn["input"]):
            return "invalid cached token count"
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, required=True)
    parser.add_argument("--auth", type=Path, default=Path.home() / ".pi/agent/auth.json")
    parser.add_argument("--mode", choices=("doctor", "pi", "direct"), default="doctor")
    parser.add_argument("models", nargs="*", choices=tuple(MODELS))
    args = parser.parse_args()
    try:
        auth = args.auth.resolve(strict=True)
        key = credential(auth)
    except (OSError, ValueError):
        raise SystemExit("Could not read Pi subscription credential metadata") from None
    repo = args.repo.resolve()
    if not (repo / "extensions/mistral-subscription/index.ts").is_file():
        raise SystemExit("Could not find the Mistral subscription extension in --repo")
    version = subprocess.run(["mise", "exec", "--", "pi", "--version"], cwd=repo, capture_output=True, text=True)
    if version.returncode or not re.fullmatch(r"\d+\.\d+\.\d+[\w.+-]*", version.stdout.strip()):
        raise SystemExit("Could not identify Pi through mise")
    if args.mode == "doctor":
        print(json.dumps({"pi": version.stdout.strip(), "subscription": "stored and unexpired"}))
        return
    if not args.models:
        parser.error("explicitly select one or more cheap model IDs")
    failed = False
    for model in dict.fromkeys(args.models):
        prefix = make_prompt()
        result = pi_probe(repo, auth, model, prefix) if args.mode == "pi" else direct_probe(key, model, prefix)
        if not result.get("failure"):
            failure = verify_pi_result(result) if args.mode == "pi" else verify_direct_result(result)
            if failure:
                result["failure"] = failure
        failed |= bool(result.get("failure"))
        print(json.dumps(result), flush=True)
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

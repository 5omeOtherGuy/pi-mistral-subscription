# Browser sign-in and stored subscription

## Sub-features

Browser URL, approval polling, API-key exchange, stored subscription and cancellation.

## How to get to it (user POV)

In Pi with the extension loaded, open `/login`, select account sign-in and choose Mistral. Complete the sign-in in Mistral AI Studio.

## Driving it with Pi

Run the OAuth tests through `mise exec -- node --test --import tsx tests/mistral-oauth.test.ts` to exercise polling and exchange with fake responses. Run the live driver's doctor to check the stored subscription and follow with the model-streaming feature to prove that the credential works.

## Gotchas

A live browser login replaces the stored Mistral credential. A stored credential can be unexpired and revoked upstream. Doctor checks local readiness only, and the streaming request verifies acceptance.

# Browser sign-in and stored subscription

## Scope

Browser URL, approval polling, API-key exchange, stored subscription and cancellation.

## Use in Pi

In Pi with the extension loaded, open `/login`, select account sign-in and choose Mistral. Complete the sign-in in Mistral AI Studio.

## Verify the behavior

Run the OAuth tests through `mise exec -- node --test --import tsx tests/mistral-oauth.test.ts` to exercise polling and exchange with fake responses. Run the live driver's doctor to check the stored subscription and follow with the model-streaming feature to prove that the credential works.

## Limits

Since v0.2.1, cancellation stops the login while a request is pending. Late responses cannot complete the cancelled login. The OAuth tests cover cancellation during polling and exchange.

A live browser login replaces the stored Mistral credential. A stored credential can be unexpired and revoked upstream. Doctor checks local readiness only, and the streaming request verifies acceptance.

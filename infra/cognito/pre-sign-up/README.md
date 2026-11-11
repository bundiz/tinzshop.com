# Pre sign-up trigger

The one AWS Lambda Tinzshop writes (plan 014, spec section 6.3, D-168). On a
Google login's first visit it makes sure there is one normal Cognito user per
email and links Google to it:

- Google says the email is not verified: reject.
- A verified normal user exists: link Google to it.
- A normal user exists but was never verified: delete it, create a new one, link.
- None exists: create a confirmed user (names from Google, random unusable
  password, no invite email), then link.

Any other trigger source (`PreSignUp_SignUp`, `PreSignUp_AdminCreateUser`) passes
through unchanged. The code is plain ESM JavaScript, with no build step.

## Deploy by hand (console)

Until hosting and infrastructure-as-code are chosen (phase 7), set it up in the
AWS console.

1. Lambda, create a function: runtime **Node.js 22.x**. The AWS SDK v3 is
   already in that runtime.
2. Paste the contents of `index.mjs` as the function's `index.mjs` (handler
   `index.handler`) and deploy.
3. Give the function's execution role the policy below, with your own region,
   account and pool id in the placeholders.
4. In the user pool, Extensions, Lambda triggers, add **Pre sign-up** and pick
   this function.
5. On the Google identity provider, the attribute mapping must include
   `email_verified`, `email`, `given_name` and `family_name`. Without
   `email_verified` every Google login is rejected.

## IAM policy (limited to the one pool)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cognito-idp:ListUsers",
        "cognito-idp:AdminLinkProviderForUser",
        "cognito-idp:AdminCreateUser",
        "cognito-idp:AdminSetUserPassword",
        "cognito-idp:AdminDeleteUser"
      ],
      "Resource": "arn:aws:cognito-idp:<region>:<account-id>:userpool/<user-pool-id>"
    }
  ]
}
```

Also attach the basic Lambda logging policy so the function can write logs. The
function logs only the trigger outcome, never an email, a password or a token.

## Known behaviour

After the link is made inside this trigger, the first Google sign-in fails once;
a retry succeeds as the linked user. The callback route retries the authorize
step once when it sees that error (Task 8), so the customer does not notice.

## Tests

`npm test` runs `index.test.mjs` with a fake Cognito client; no network, no AWS.

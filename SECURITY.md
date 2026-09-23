# Security policy

Do not report security issues in public issues. Until a dedicated security
contact is configured, contact the repository owners privately through GitHub:
`@Soypete` or `@colinso`.

Do not include secrets, access tokens, private endpoints, personal data, or
production identifiers in reports or pull requests.

Skills must fail closed when they encounter missing authorization, ambiguous
scope, malformed tool input, or unavailable dependencies. They must not direct
an agent to bypass access controls, expose credentials, or persist raw private
content.

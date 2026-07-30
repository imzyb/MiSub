# Full profile templates

Full profile templates let a MiSub profile provide the nodes while a user-owned
configuration provides everything else. MiSub preserves DNS, routing, TUN,
scripts, rule providers, and other client-specific settings. It only appends the
generated nodes and expands explicit group member markers.

Supported targets:

- `clash` (Mihomo/Clash YAML)
- `singbox` (JSON or JSON5)
- `surge`
- `loon`
- `quanx`
- `egern`

## Member markers

Place markers where a policy group expects node names:

- `{{MISUB_ALL}}`: all generated nodes.
- `{{MISUB_INCLUDE:regex}}`: generated nodes whose final names match `regex`.
- `{{MISUB_EXCLUDE:regex}}`: generated nodes whose final names do not match `regex`.

Matching is case-insensitive and runs after the profile's operator chain, so the
markers see the same renamed and deduplicated node names as the final output.
Invalid regular expressions and static/dynamic node name conflicts fail the
render instead of silently producing a broken configuration.

### Clash/Mihomo

```yaml
proxies: []
proxy-groups:
  - name: Proxy
    type: select
    proxies:
      - DIRECT
      - "{{MISUB_ALL}}"
  - name: Hong Kong
    type: url-test
    proxies:
      - "{{MISUB_INCLUDE:(HK|香港|Hong Kong)}}"
rules:
  - MATCH,Proxy
```

### Sing-box

JSON5 comments and trailing commas are supported.

```json5
{
  "dns": { "servers": [{ "type": "local", "tag": "dns-local" }] },
  "outbounds": [
    {
      "type": "selector",
      "tag": "Proxy",
      "outbounds": ["direct", "{{MISUB_ALL}}"],
    },
    {
      "type": "urltest",
      "tag": "Hong Kong",
      "outbounds": ["{{MISUB_INCLUDE:(HK|香港|Hong Kong)}}"],
    },
    { "type": "direct", "tag": "direct" },
  ],
  "route": { "final": "Proxy" },
}
```

### Surge and Loon

```ini
[Proxy]
DIRECT = direct

[Proxy Group]
Proxy = select, DIRECT, {{MISUB_ALL}}
Hong Kong = url-test, {{MISUB_INCLUDE:(HK|香港|Hong Kong)}}, url=https://www.gstatic.com/generate_204

[Rule]
FINAL,Proxy
```

### Quantumult X

```ini
[server_local]

[policy]
static=Proxy, direct, {{MISUB_ALL}}
url-latency-benchmark=Hong Kong, {{MISUB_INCLUDE:(HK|香港|Hong Kong)}}

[filter_local]
final, Proxy
```

### Egern

```yaml
proxies: []
policy_groups:
  - select:
      name: Proxy
      policies:
        - DIRECT
        - "{{MISUB_ALL}}"
rules:
  - default:
      policy: Proxy
```

## Multiple configurations for one profile

Create multiple enabled templates with `type: profile`, then select one by ID:

```text
/<profile-token>/<profile-id>?target=singbox&template=custom:android
/<profile-token>/<profile-id>?target=singbox&template=custom:router
/<profile-token>/<profile-id>?target=clash&template=custom:windows
```

Only saved `custom:` and built-in template IDs are accepted from this query
parameter. Arbitrary remote URLs are not accepted.

The profile link dialog lists all enabled full profile templates and generates
the corresponding target/template URL automatically.

## Security

The complete template is returned to every caller who can access the generated
profile URL. Do not put private keys or reusable authentication tokens in a
template unless the profile share token is treated as a secret and can be
rotated when exposed.

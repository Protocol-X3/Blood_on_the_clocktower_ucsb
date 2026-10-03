---
name: script-from-photo
description: Turn a photo of a Blood on the Clocktower (血染钟楼) script sheet into a script in this app's database — read every role, match it against the role library by meaning, create 自制角色 for homebrew roles, and save it as the owner. Use when the owner sends a script photo and asks to create, add, build or save a script (剧本) from it.
---

# Script from photo (M6)

The owner sends a photo of a script sheet; you turn it into a script in the database, as the
owner. There is no in-app upload: this skill *is* the feature. The owner's rules below come from a
guided walkthrough of 梦殒春宵, 夜半狂欢 and 钟声来了 (2026-09-28); follow them exactly.

**Ask the owner (AskUserQuestion, with a recommended option) whenever this skill says so.**
Never save before the owner has approved the plan.

## Tools

Run from the repo root. Both talk to Supabase over **HTTPS** with a single-purpose **import
token** (SCRIPT-07), so they work on the owner's PC and in cloud sessions alike (a cloud session's
proxy carries only web traffic; a direct database connection just hangs). They read
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `SCRIPT_IMPORT_TOKEN` from `.env.local`
or the environment, and never print secrets. The token can only read the role library and save
scripts; it can't touch anything else.

- **A cloud session** needs those three as the environment's variables, and network access to the
  project's `*.supabase.co` host. It doesn't need `SUPABASE_DB_URL`.
- **`✗ … SCRIPT_IMPORT_TOKEN is missing or out of date`** → on the owner's PC,
  `node tools/db.ts import-token` makes a new token (it replaces the old one, which stops working)
  and writes it into `.env.local`; the owner copies it into the cloud environment's variables.
  Never ask for the token in chat.

- `node tools/compare-script.ts <photo.json>` — matches the transcription against the **live**
  library (official roles and 自制角色) and prints, per role: `=` identical apart from punctuation,
  `≠` with a character diff (`[+added-removed]`), `?` not in the library, plus team mismatches and
  other versions of the same character.
- `node tools/save-script.ts <spec.json> [--dry-run]` — sends the spec to the database's
  `import_script`, which creates the new 自制角色 and saves the script in one transaction, as the
  admin, through the app's own RPCs (`create_custom_role`, `save_script`), then returns every role
  as saved, plus the script's 特殊规则. It refuses a script name that already exists (unless
  `"replace": true`) and a 自制角色 whose name is already taken. `--dry-run` does all of it and
  rolls back.

Put working files (transcription, spec) in the session's scratchpad, not in the repo.

## 1. Read the sheet

- **Name:** the title. **Author:** the 剧本作者 line only (ignore 美术设计, illustrators, handles);
  `null` if there is none.
- **Teams** come from the section headers: 善良阵营·镇民 → `townsfolk`, 善良阵营·外来者 →
  `outsider`, 邪恶阵营·爪牙 → `minion`, 邪恶阵营·恶魔 → `demon`.
- **Transcribe every role verbatim**: name and ability, including `*`, brackets and setup
  modifiers like `[+1外来者]`, which are part of the ability. Keep the sheet's order within each
  team: left column top to bottom, then right column.
- **Left out** (the app has no place for them; list them in your summary): 传奇角色 (Fabled),
  旅行者 (Travellers), 相克规则 (jinx notes), the night-order sidebars, "支持7-15人" and the
  glossary (疯狂, 中毒/醉酒 …).
- **特殊规则** (SCRIPT-08): rules the sheet adds for this script, usually in a box titled
  特殊规则 (or 剧本规则 / 额外规则). Transcribe them verbatim into `special_rules`, one rule per
  line, at most 2000 characters; `null` if the sheet has none. The app only shows them in 剧本库;
  nothing in a game reads them. If you can't tell whether a box is a 特殊规则 (rather than a
  jinx, a night-order note or the glossary), ask.
- If any text is unreadable or ambiguous, ask for a clearer photo. Don't guess a word.

Write the transcription as JSON: `[["townsfolk", "钟表匠", "在你的首个夜晚，…"], …]`.

## 2. Compare with the library

Run `tools/compare-script.ts` on it. Check the photo's team counts against the sheet.

## 3. Judge every difference by meaning

For each `≠`, decide whether the ability **means** the same thing:

- **Same meaning → use the library role**, even if the name or wording differs. Examples judged
  "same" so far: synonyms (拜访/询问, 获得/以得知, 杀了/杀死了, 如果/如果当…时), punctuation, and
  parenthetical side notes that name a reminder token or a nickname (理发师 "（今晚理发）",
  麻脸巫婆 "（生死无常夜）", 教授 "（复活）", 艺术家 "（是/不是/我不知道）").
- **Different meaning → a separate role.** One word can change everything: "选择一名玩家" vs
  "选择一名存活的玩家", "你要选择" (must) vs "你可以选择" (may), 首个夜晚 vs 每个夜晚*, a different
  setup modifier. Compare word by word; don't trust overall similarity.
- **Unsure → ask the owner**, showing the diff and your reading. (Example: 哈迪寂亚 printed
  "你要选择" where the library and the official English say "may"; the owner chose the library
  role, treating it as loose wording on that sheet.)
- **Team differs** from the library → ask.

## 4. Decide each role

- **Several versions in the library** (the tool lists `OTHER VERSIONS`, e.g. 气球驾驶员 /
  气球驾驶员（旧版）, 戏子 / 戏子（改）, 禁卫军 / 禁卫军（改）) → **always ask** which version this
  script uses, even if one matches the sheet's text exactly. (夜半狂欢 printed the original
  气球驾驶员, but the owner chose the current one.)
- **Not in the library (`?`) or a different meaning** → first check the official wiki
  (clocktower-wiki.gstonegames.com). Look up the page and search the ability text:
  - page: `https://clocktower-wiki.gstonegames.com/index.php?action=raw&title=<URL-encoded name>`
  - text search: `https://clocktower-wiki.gstonegames.com/api.php?action=query&list=search&srsearch=<URL-encoded phrase>&srwhat=text&format=json`
  - old versions of a page: its revision history (`api.php?action=query&prop=revisions&titles=…`).
- **It's an official role (or an official older version) missing from the library** → it
  becomes an **official** role in its edition, not a 自制角色. Ask the owner first, then: add it
  to `supabase/data/official-roles.json`, its id to the edition's list in `tools/lib/roles.ts`,
  bump the counts in `supabase/tests/m2_library.test.sql`, update LIB-01 in
  `docs/rules/m2-setup-roles.md`, run `node tools/gen-roles-migration.ts <timestamp>_<name>.sql`,
  record it in the roadmap's decision log, and ship it as a PR. After merge + CI, apply it with
  `node tools/db.ts push` **from a `main` checkout on the owner's PC** (it needs
  `SUPABASE_DB_URL`, which cloud sessions don't have; a cloud session hands this step to the PC). (Example: 气球驾驶员（旧版）, id `balloonist_old`, text from the sheet.)
- **Not official anywhere → a new 自制角色** (edition `homebrew`):
  - name as printed; if a library role already has that name, **ask**, suggesting the next free
    suffix: 名字（改）, then （改2）, （改3）… (戏子（改） is official, so a homebrew 戏子 would be 戏子（改2）);
  - team from its section, ability verbatim (≤ 300 characters), name ≤ 20 characters;
  - glyph: the first character of the name unless another role already uses it; then pick another
    distinctive character of the name (卡牌大师 → 牌, because 卡 is 卡扎力);
  - reminder tokens only if the sheet shows them, otherwise none.
- **A 自制角色 saved for an earlier script** shows up as a library match; reuse it by its id
  under the same rules (same meaning → reuse; different → new role).

## 5. Show the plan and ask

Summarize for the owner before saving:

- name, author, role counts per team, and that the order follows the sheet;
- the 特殊规则 as you'll save them (or "none");
- a table of every `≠` role: the difference and your verdict (and why);
- the new 自制角色 (name, team, ability, glyph, tokens) and any official role to add;
- what's left out (Fabled, Travellers, 相克规则 …);
- **if the script name already exists**: what differs from the saved script (特殊规则 included),
  and ask whether to replace it (`"replace": true`), save under a new name, or stop. Replacing
  overwrites everything, 特殊规则 too, so the spec must carry the ones to keep.

Then ask for approval (e.g. "Save it" / "Change something first").

## 6. Save and verify

Write the spec (library ids, and `{"custom": {…}}` objects for new 自制角色, in script order;
`special_rules` is a string with `\n` between rules, or `null`):

```json
{ "name": "钟声来了", "author": "Bruce C.", "special_rules": null, "roles": [
  "clockmaker", "chambermaid",
  { "custom": { "name": "卡牌大师", "team": "townsfolk", "ability": "每个夜晚，…", "glyph": "牌", "reminders": [] } },
  "monk" ] }
```

1. `node tools/save-script.ts spec.json --dry-run` and check the readback: every role, in order,
   on the right team, count matching the sheet, and the 特殊规则 as on the sheet.
2. Run it again without `--dry-run`.
3. Tell the owner it's saved: name, author, role count, new 自制角色, 特殊规则 (if any), what was
   left out, and that it's in 剧本库 (home page → 剧本库, or `/scripts`).

## Record

Record only a **special decision**: the owner answered one of this skill's questions (a version
choice, an unsure wording, a name clash, a replace) or set a new rule. Then add it to this skill so
the next script follows it, add a dated line to the roadmap's decision log, and commit and push.

A routine import needs no record and no commit: every role followed the rules above, your
"same meaning" calls were the obvious kind (synonyms, side notes, nicknames), and the owner only
approved the plan. Saving the script is the whole job.

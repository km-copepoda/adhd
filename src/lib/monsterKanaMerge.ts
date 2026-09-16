// モンスター図鑑・コレクションアイテムの「かなCSV」→ TSソースへのマージロジック（純粋関数群）。
// Issue #139: 判定・検証・書き換えロジックは src/lib/ に置く（scripts/ はテスト対象外のため。
// docs/decisions.md Issue #109 の既存決定に従う）。
//
// scripts/gen-monster-collection-kana.ts はここの関数を呼び出すだけの薄いI/O CLIとする。

/** CSVの1データ行に対応するレコード。 */
export type KanaRecord = {
  source: string;
  key: string;
  name: string;
  nameKana: string;
  description: string;
  descriptionKana: string;
};

export type KanaCsvError = { line: number; reason: string };

export type ParseKanaCsvResult =
  | { ok: true; records: KanaRecord[] }
  | { ok: false; errors: KanaCsvError[] };

/**
 * 反映先データセットを表す判別型。
 * `applyKanaRecordsToSource` の1回の呼び出しは、必ずこのうちの1種類だけを対象にする。
 */
export type KanaSource =
  | "monsters_dark_egg"
  | "monsters_light_egg"
  | "buddha_egg"
  | "monsters_dark_table"
  | "monsters_light_table"
  | "buddha_table"
  | "collection";

export type KanaMergeError = { source: string; key: string; reason: string };

export type KanaMergeResult =
  | { ok: true; sourceText: string; appliedCount: number; skippedCount: number }
  | { ok: false; errors: KanaMergeError[] };

const REQUIRED_COLUMNS = 6;

/**
 * かなCSVをパースする。ダブルクォート囲み・カンマ内包・`""`エスケープ・CRLF・
 * 先頭BOM・末尾空行に対応した状態機械によるパーサー（単純な split(",") は使わない）。
 */
export function parseKanaCsv(csvText: string): ParseKanaCsvResult {
  const text = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText;

  type State = "START_FIELD" | "IN_FIELD" | "IN_QUOTED_FIELD" | "AFTER_QUOTE";

  const errors: KanaCsvError[] = [];
  const dataRows: { fields: string[]; line: number }[] = [];

  let state: State = "START_FIELD";
  let field = "";
  let row: string[] = [];
  let line = 1;
  let rowStartLine = 1;
  let skipToEol = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    pushField();
    // 中身が完全に空の行（空行）は無視する
    if (!(row.length === 1 && row[0] === "")) {
      dataRows.push({ fields: row, line: rowStartLine });
    }
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === "\r") continue;

    if (ch === "\n") {
      if (skipToEol) {
        skipToEol = false;
      } else if (state === "IN_QUOTED_FIELD") {
        // クオート内の改行はフィールドの一部（複数行フィールド）
        field += "\n";
        line++;
        continue;
      } else {
        pushRow();
      }
      state = "START_FIELD";
      line++;
      rowStartLine = line;
      continue;
    }

    if (skipToEol) continue;

    switch (state) {
      case "START_FIELD":
        if (ch === '"') {
          state = "IN_QUOTED_FIELD";
        } else if (ch === ",") {
          pushField();
        } else {
          field += ch;
          state = "IN_FIELD";
        }
        break;

      case "IN_FIELD":
        if (ch === ",") {
          pushField();
          state = "START_FIELD";
        } else {
          field += ch;
        }
        break;

      case "IN_QUOTED_FIELD":
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            state = "AFTER_QUOTE";
          }
        } else {
          field += ch;
        }
        break;

      case "AFTER_QUOTE":
        if (ch === ",") {
          pushField();
          state = "START_FIELD";
        } else {
          errors.push({
            line: rowStartLine,
            reason: `${rowStartLine}行目: 閉じクオート直後に余分な文字があります`,
          });
          skipToEol = true;
        }
        break;
    }
  }

  if (state === "IN_QUOTED_FIELD" || state === "AFTER_QUOTE") {
    if (state === "IN_QUOTED_FIELD") {
      errors.push({ line: rowStartLine, reason: `${rowStartLine}行目: クオートが閉じられていません` });
    } else if (!skipToEol) {
      pushRow();
    }
  } else if (!skipToEol && (field !== "" || row.length > 0)) {
    pushRow();
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const body = dataRows.slice(1); // 先頭行はヘッダーとして読み捨てる

  const records: KanaRecord[] = [];
  for (const { fields, line: rowLine } of body) {
    if (fields.length !== REQUIRED_COLUMNS) {
      errors.push({
        line: rowLine,
        reason: `${rowLine}行目: 列数が不正です（期待${REQUIRED_COLUMNS}, 実際${fields.length}）`,
      });
      continue;
    }
    const [source, key, name, nameKana, description, descriptionKana] = fields;
    if (!source || !key || !name || !nameKana || !description || !descriptionKana) {
      errors.push({ line: rowLine, reason: `${rowLine}行目: 必須列が空欄です` });
      continue;
    }
    records.push({ source, key, name, nameKana, description, descriptionKana });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, records };
}

/**
 * CSVレコードの name/description が、対象ファイルから抽出した実際の値と
 * 完全一致するかを検証する。例外は投げず結果型で返す。
 */
export function validateKanaRecord(
  record: KanaRecord,
  actualName: string,
  actualDescription: string,
): { ok: true } | { ok: false; reason: string } {
  if (record.name !== actualName) {
    return {
      ok: false,
      reason: `name が一致しません（CSV: "${record.name}" / 実際: "${actualName}"）`,
    };
  }
  if (record.description !== actualDescription) {
    return {
      ok: false,
      reason: `description が一致しません（CSV: "${record.description}" / 実際: "${actualDescription}"）`,
    };
  }
  return { ok: true };
}

/** TS文字列リテラルの内容（クオートの中身）を実際の文字列にデコードする。 */
function unescapeTsString(raw: string): string {
  let result = "";
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === "\\" && i + 1 < raw.length) {
      const next = raw[i + 1];
      if (next === '"') result += '"';
      else if (next === "\\") result += "\\";
      else if (next === "n") result += "\n";
      else if (next === "t") result += "\t";
      else result += next;
      i++;
    } else {
      result += raw[i];
    }
  }
  return result;
}

/** 実際の文字列値をTS文字列リテラルの中身として正しくエスケープする。 */
function tsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// TS文字列リテラル（ダブルクォート囲み、"" エスケープ・バックスラッシュエスケープ対応）にマッチする断片。
const TS_STRING = `"(?:[^"\\\\]|\\\\.)*"`;

function extractRawField(body: string, fieldName: string): string | undefined {
  const re = new RegExp(`\\b${fieldName}:\\s*(${TS_STRING})`);
  const m = re.exec(body);
  if (!m) return undefined;
  return m[1].slice(1, -1); // 前後のダブルクォートを除いた中身
}

type CandidateEntry = {
  start: number; // "{" の位置
  end: number; // "}" の直後の位置
  body: string; // 中身（波括弧を含まない）
  tableKey?: string; // `"KEY": { ... }` の形で直前にクオートされたキーがある場合
  idKey?: string; // 中身に `id: "KEY"` フィールドがある場合（コレクションアイテム）
};

/** 文字列・エスケープを考慮しつつ、ソース中の全ての波括弧の対応範囲を求める。 */
function findBraceSpans(sourceText: string): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = [];
  const stack: number[] = [];
  let inString: '"' | "'" | "`" | null = null;

  for (let i = 0; i < sourceText.length; i++) {
    const ch = sourceText[i];
    if (inString) {
      if (ch === "\\") {
        i++;
      } else if (ch === inString) {
        inString = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
    } else if (ch === "{") {
      stack.push(i);
    } else if (ch === "}") {
      const start = stack.pop();
      if (start !== undefined) spans.push({ start, end: i + 1 });
    }
  }
  return spans;
}

/**
 * ソース中の「対象オブジェクト範囲」を先に特定してから走査する契約に従い、
 * name/description の文字列リテラルを直接持つ「葉」オブジェクト（ネストした波括弧を
 * 持たないオブジェクト）だけを候補として抽出する。型注釈（`{ name: string; ... }`）は
 * 文字列リテラル値を持たないため自然に除外される。
 */
function extractCandidateEntries(sourceText: string): CandidateEntry[] {
  const spans = findBraceSpans(sourceText);
  const candidates: CandidateEntry[] = [];

  for (const { start, end } of spans) {
    const body = sourceText.slice(start + 1, end - 1);
    if (body.includes("{")) continue; // ネストがあるコンテナは対象外（テーブル全体など）

    const hasName = new RegExp(`\\bname:\\s*${TS_STRING}`).test(body);
    const hasDescription = new RegExp(`\\bdescription:\\s*${TS_STRING}`).test(body);
    if (!hasName || !hasDescription) continue;

    const before = sourceText.slice(0, start);
    const tableKeyMatch = /"((?:[^"\\]|\\.)*)"\s*:\s*$/.exec(before);
    const tableKey = tableKeyMatch ? unescapeTsString(tableKeyMatch[1]) : undefined;

    const idKeyRaw = extractRawField(body, "id");
    const idKey = idKeyRaw !== undefined ? unescapeTsString(idKeyRaw) : undefined;

    candidates.push({ start, end, body, tableKey, idKey });
  }

  return candidates;
}

// KanaSource ごとに対応する宣言名（`export const <NAME> = ...`）。
// 同一ファイル内に同じキーを持つ複数のテーブル（例: monsters.ts の MONSTER_TABLE と
// MONSTER_TABLE_LIGHT はどちらも "STUDY" キーを持つ）が存在するため、対象宣言の
// オブジェクト範囲を先に特定してから走査しないと誤マッチ（複数件ヒット）が起きる。
// "collection" のみ、id がファイル全体で一意なため宣言スコープの絞り込みは不要。
const DECLARATION_NAME: Record<KanaSource, string | null> = {
  monsters_dark_egg: "EGG_STAGE",
  monsters_light_egg: "EGG_STAGE_LIGHT",
  buddha_egg: "EGG_STAGE",
  monsters_dark_table: "MONSTER_TABLE",
  monsters_light_table: "MONSTER_TABLE_LIGHT",
  buddha_table: "MONSTER_TABLE",
  collection: null,
};

/**
 * `export const <declarationName> ... = { ... };` の右辺オブジェクトリテラルの
 * 波括弧範囲（開始 `{` の位置 〜 終了 `}` の直後の位置）を返す。
 */
function findDeclarationObjectRange(
  sourceText: string,
  declarationName: string,
): { start: number; end: number } | undefined {
  const declRe = new RegExp(`\\bconst\\s+${declarationName}\\b`);
  const declMatch = declRe.exec(sourceText);
  if (!declMatch) return undefined;

  const afterDecl = declMatch.index + declMatch[0].length;
  const eqRe = /=\s*\{/;
  const eqMatch = eqRe.exec(sourceText.slice(afterDecl));
  if (!eqMatch) return undefined;

  const braceStart = afterDecl + eqMatch.index + eqMatch[0].length - 1;
  const spans = findBraceSpans(sourceText);
  return spans.find((s) => s.start === braceStart);
}

/**
 * sourceText 中の対象エントリを一意に特定し、name/description を検証したうえで
 * kanaフィールドを挿入する。冪等性ルール:
 *  - 未適用 → 挿入
 *  - 既存値がCSVと同値 → no-op（skippedCountに計上）
 *  - 既存値がCSVと異なる、または片方だけ存在する → エラー
 * 対象エントリが0件・複数件マッチした場合もエラー（no-opにしない）。
 *
 * 原子性についての注意: この関数自体は sourceText 文字列を返すだけであり、
 * 実際のファイル書き込み（複数ファイルに対する writeFileSync の呼び出し）に関する
 * ファイルシステムレベルの原子性は保証しない。呼び出し側（scripts/ の CLI）が
 * 「全件検証完了後にまとめて書き込む」ことで部分適用を防ぐ。
 */
export function applyKanaRecordsToSource(
  sourceText: string,
  source: KanaSource,
  records: readonly KanaRecord[],
): KanaMergeResult {
  const allCandidates = extractCandidateEntries(sourceText);
  const isEggSource = source.endsWith("_egg");
  const isCollectionSource = source === "collection";

  const declarationName = DECLARATION_NAME[source];
  const errors: KanaMergeError[] = [];

  let candidates = allCandidates;
  if (declarationName !== null) {
    const range = findDeclarationObjectRange(sourceText, declarationName);
    if (!range) {
      return {
        ok: false,
        errors: records.map((r) => ({
          source: r.source,
          key: r.key,
          reason: `宣言 "${declarationName}" がソース中に見つかりません`,
        })),
      };
    }
    candidates = allCandidates.filter((c) => c.start >= range.start && c.end <= range.end);
  }

  const insertions: { start: number; end: number; newBody: string }[] = [];
  let appliedCount = 0;
  let skippedCount = 0;

  for (const record of records) {
    let matches: CandidateEntry[];
    if (isEggSource) {
      matches = candidates.filter((c) => c.tableKey === undefined && c.idKey === undefined);
    } else if (isCollectionSource) {
      matches = candidates.filter((c) => c.idKey === record.key);
    } else {
      matches = candidates.filter((c) => c.tableKey === record.key);
    }

    if (matches.length !== 1) {
      errors.push({
        source: record.source,
        key: record.key,
        reason:
          matches.length === 0
            ? `対象キー "${record.key}" のエントリが見つかりません`
            : `対象キー "${record.key}" に一致するエントリが複数存在します`,
      });
      continue;
    }

    const entry = matches[0];
    const rawName = extractRawField(entry.body, "name");
    const rawDescription = extractRawField(entry.body, "description");
    if (rawName === undefined || rawDescription === undefined) {
      errors.push({
        source: record.source,
        key: record.key,
        reason: "name/description の文字列リテラルを抽出できませんでした",
      });
      continue;
    }

    const actualName = unescapeTsString(rawName);
    const actualDescription = unescapeTsString(rawDescription);
    const validation = validateKanaRecord(record, actualName, actualDescription);
    if (!validation.ok) {
      errors.push({ source: record.source, key: record.key, reason: validation.reason });
      continue;
    }

    const rawNameKana = extractRawField(entry.body, "nameKana");
    const rawDescriptionKana = extractRawField(entry.body, "descriptionKana");

    if (rawNameKana !== undefined && rawDescriptionKana !== undefined) {
      const actualNameKana = unescapeTsString(rawNameKana);
      const actualDescriptionKana = unescapeTsString(rawDescriptionKana);
      if (actualNameKana === record.nameKana && actualDescriptionKana === record.descriptionKana) {
        skippedCount++;
      } else {
        errors.push({
          source: record.source,
          key: record.key,
          reason: "既存のkana値がCSVと異なります",
        });
      }
      continue;
    }
    if (rawNameKana !== undefined || rawDescriptionKana !== undefined) {
      errors.push({
        source: record.source,
        key: record.key,
        reason: "nameKana/descriptionKanaの片方だけが存在します",
      });
      continue;
    }

    let newBody = entry.body.replace(
      new RegExp(`(\\bname:\\s*${TS_STRING})`),
      `$1, nameKana: "${tsEscape(record.nameKana)}"`,
    );
    newBody = newBody.replace(
      new RegExp(`(\\bdescription:\\s*${TS_STRING})`),
      `$1, descriptionKana: "${tsEscape(record.descriptionKana)}"`,
    );

    insertions.push({ start: entry.start, end: entry.end, newBody: `{${newBody}}` });
    appliedCount++;
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  insertions.sort((a, b) => b.start - a.start);
  let resultText = sourceText;
  for (const ins of insertions) {
    resultText = resultText.slice(0, ins.start) + ins.newBody + resultText.slice(ins.end);
  }

  return { ok: true, sourceText: resultText, appliedCount, skippedCount };
}

export type SetupGuideStep = {
  step: number;
  title: string;
  description: string;
  href: string;
};

export const SETUP_GUIDE_STORAGE_KEY = "parent-setup-guide-seen";

export function shouldShowSetupGuide(hasSeen: boolean): boolean {
  return !hasSeen;
}

export function getSetupGuideSteps(): SetupGuideStep[] {
  return [
    {
      step: 1,
      title: "子どもを追加しよう",
      description: "「ファミリー管理」で子どものアカウントを作成します。名前とキャラクタースタイルを選びましょう。",
      href: "/app/parent/family",
    },
    {
      step: 2,
      title: "タスクを作ろう",
      description: "このページでクエストを作成します。毎週繰り返す通常タスクか、特定日だけの一時タスクが選べます。",
      href: "/app/parent/tasks",
    },
    {
      step: 3,
      title: "コードを子どもに渡そう",
      description: "「ファミリー管理」でファミリーコードとユーザーコードを確認。子どものデバイスでログインできます。",
      href: "/app/parent/family",
    },
  ];
}

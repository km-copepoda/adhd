export type SetupProgress = {
  hasChild: boolean;
  hasTask: boolean;
  childLoggedIn: boolean;
};

export type SetupGuideStep = {
  step: number;
  title: string;
  description: string;
  href: string;
  progressKey: keyof SetupProgress;
};

export function isSetupComplete(progress: SetupProgress): boolean {
  return progress.hasChild && progress.hasTask && progress.childLoggedIn;
}

export function getSetupGuideSteps(): SetupGuideStep[] {
  return [
    {
      step: 1,
      title: "子どもを追加しよう",
      description: "「ファミリー管理」で子どものアカウントを作成します。名前とキャラクタースタイルを選びましょう。",
      href: "/app/parent/family",
      progressKey: "hasChild",
    },
    {
      step: 2,
      title: "タスクを作ろう",
      description: "このページでクエストを作成します。毎週繰り返す通常タスクか、特定日だけの一時タスクが選べます。",
      href: "/app/parent/tasks",
      progressKey: "hasTask",
    },
    {
      step: 3,
      title: "子どもにログインしてもらおう",
      description: "「ファミリー管理」でコードを確認し、子どものデバイスでログインしてもらいましょう。",
      href: "/app/parent/family",
      progressKey: "childLoggedIn",
    },
  ];
}

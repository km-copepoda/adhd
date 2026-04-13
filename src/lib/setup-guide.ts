export type SetupGuideStep = {
  step: number;
  title: string;
  description: string;
};

export function shouldShowSetupGuide(hasSeen: boolean): boolean {
  return !hasSeen;
}

export function getSetupGuideSteps(): SetupGuideStep[] {
  return [
    {
      step: 1,
      title: "タスクを作ろう",
      description: "「タスク管理」でクエストを作成。毎日繰り返す通常タスクか、特定日だけの一時タスクが作れます。",
    },
    {
      step: 2,
      title: "子どもにコードを渡そう",
      description: "「ファミリー管理」でファミリーコードとユーザーコードを確認。子どものデバイスでログインできます。",
    },
    {
      step: 3,
      title: "承認センターをチェック",
      description: "子どもがタスクを完了報告すると通知が届きます。「承認センター」で確認・承認してあげましょう。",
    },
  ];
}

/**
 * 指定パスで BottomNav を表示すべきか返す。
 * ログイン（onboarding）画面では非表示にする。
 */
export function shouldShowBottomNav(pathname: string): boolean {
  return pathname !== "/child/login";
}

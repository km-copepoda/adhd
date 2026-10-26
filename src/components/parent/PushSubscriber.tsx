"use client";
import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

const VAPID_KEY_STORAGE = "vapid_pub_key";

async function postSubscription(sub: PushSubscription) {
  return fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub),
  });
}

async function registerSubscription() {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return;
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const storedKey = localStorage.getItem(VAPID_KEY_STORAGE);

  // VAPIDキーが変わった（または未設定時に作られた）購読は破棄して再作成
  if (existing && storedKey !== vapidKey) {
    await existing.unsubscribe();
  }

  const subscribe = () =>
    reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

  const current = (storedKey === vapidKey ? existing : null) ?? (await subscribe());

  localStorage.setItem(VAPID_KEY_STORAGE, vapidKey);

  const res = await postSubscription(current);
  // 別アカウントが所有する購読が同じブラウザに残っている場合（アカウント切替）は、
  // 購読を破棄して新規作成し直す
  if (res.status === 409) {
    await current.unsubscribe();
    await postSubscription(await subscribe());
  }
}

export default function PushSubscriber({
  className,
  iconClassName = "",
  labelClassName = "",
  showDenied = false,
}: {
  className?: string;
  iconClassName?: string;
  labelClassName?: string;
  showDenied?: boolean;
}) {
  const [permission, setPermission] = useState<NotificationPermission | null>(null);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    // Notification API依存の判定でSSR時は実行できないため、マウント後にuseEffect内で一度だけ現在の許可状態を確認する。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPermission(Notification.permission);
    // 既に許可済みなら購読を静かに更新
    if (Notification.permission === "granted") {
      registerSubscription().catch(() => {});
    }
  }, []);

  if (permission === "denied" && showDenied) {
    return (
      <button
        onClick={() => alert("ブラウザの設定 → サイトの設定 → 通知 を「許可」に変えてね！")}
        className={className}
        title="通知がオフになっています"
      >
        <span className={iconClassName}>🔕</span>
        <span className={labelClassName}>通知オフ</span>
      </button>
    );
  }

  // 未確認の場合のみボタンを表示
  if (permission !== "default") return null;

  async function handleClick() {
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm === "granted") await registerSubscription();
  }

  return (
    <button onClick={handleClick} className={className} title="通知を有効にする">
      <span className={iconClassName}>🔔</span>
      <span className={labelClassName}>通知を有効にする</span>
    </button>
  );
}

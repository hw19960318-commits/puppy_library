import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-amber-800/60">加载中…</div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}

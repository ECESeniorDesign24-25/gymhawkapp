// utils/notify.ts
import { db, auth } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";

export async function subscribeToMachine(machineId: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("not‑signed‑in");

  const waiterRef = doc(
    db,
    "subscriptions",
    machineId,
    "waiters",
    user.uid
  );

  await setDoc(waiterRef, {
    email: user.email,
    createdAt: Date.now(),
  });
}
  
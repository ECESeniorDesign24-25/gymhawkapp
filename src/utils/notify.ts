// utils/notify.ts
import { db, auth } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import {Machine} from "@/interfaces/machine";

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

export async function triggerEmailNotification(machine: Machine) {
  try {
    const response = await fetch("https://us-central1-gymhawk-2ed7f.cloudfunctions.net/email_on_available", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        machine_id: machine.thing_id,
        machine_name: machine.machine_type,
        previous_state: "on"
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Unknown error");
    }
    console.log("Email function triggered:", data);
  } catch (err) {
    console.error("Failed to trigger email function:", err);
  }
}

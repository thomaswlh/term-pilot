import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { appStore } from "@/db/server-store";

export default async function HomePage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }
  const profile = await appStore.getProfile(userId);
  if (!profile.saved) {
    redirect("/profile");
  }
  redirect("/timetables");
}

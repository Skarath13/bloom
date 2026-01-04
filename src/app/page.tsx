import { redirect } from "next/navigation";

export default function Home() {
  // Redirect to booking page
  redirect("/book");
}

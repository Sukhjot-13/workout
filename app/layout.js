import "./globals.css";
import ManagerProvider from "@/lib/manager/ManagerProvider";

export const metadata = {
  title: "Lean Athletic Workout Tracker",
  description: "Personal workout tracker with automatic cloud synchronization.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#090d16",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ManagerProvider />
        {children}
      </body>
    </html>
  );
}

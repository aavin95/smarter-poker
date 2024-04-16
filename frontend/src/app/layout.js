import { Inter } from "next/font/google"
import Navbar from "../components/Navbar"
import Footer from "../components/Footer"
import AuthProvider from "./context/AuthProvider"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Smater Poker",
  description: "A better way to play poker online",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <Navbar />
          {children}
          <Footer />
        </AuthProvider>
        </body>
    </html>
  );
}

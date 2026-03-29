"use client";

import useLocalStorage from "@/hooks/useLocalStorage";
import { UserOutlined } from "@ant-design/icons";
import { Button, message } from "antd";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const navItems = [
  { label: "Home", href: "/home" },
  { label: "Play", href: "/play" },
  { label: "History", href: "/history" },
];

const Navbar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { clear: clearToken } = useLocalStorage<string>("token", "");
  const { clear: clearUserId } = useLocalStorage<string>("userId", "");
  const [messageApi, contextHolder] = message.useMessage();
  const [isGuest, setIsGuest] = useState(false);

  // to check the stored string for Guest- prefix we need to parse it first, since we store it as JSON string
  const readStorageString = (key: string) => {
    const raw = localStorage.getItem(key);
    if (!raw) return "";
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === "string" ? parsed : String(parsed);
    } catch {
      return raw;
    }
  };

  useEffect(() => {
    const token = readStorageString("token");
    setIsGuest(token.startsWith("Guest-"));
  }, [pathname]);

  const isGuestUser = () => readStorageString("token").startsWith("Guest-");

  const handleProfileClick = () => {
    if (isGuestUser()) {
      messageApi.info("Guest users have limited access. Please log in to view your profile.");
      return;
    }
    router.push("/profile");
  };

  const handleLogout = () => {
    clearToken();
    clearUserId();
    // have to put status to offline here
    router.push("/login");
  };

  const handleNavClick = (href: string) => {
    if (href === "/history" && isGuestUser()) {
      messageApi.info("Guest users have limited access. Please log in to view history.");
      return;
    }
    router.push(href);
  };

  return (
    <>
    {contextHolder}
    <header className="top-nav">
      <div className="top-nav-left">
        {navItems.map((item) => (
          <Button
            key={item.href}
            type={pathname === item.href ? "primary" : "text"}
            className={`top-nav-link ${pathname === item.href ? "is-active" : ""}`}
            onClick={() => handleNavClick(item.href)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className="top-nav-right">
          {isGuest ? (
            <Button
              type="primary"
              className="top-nav-login"
              onClick={handleLogout} // for guests this will just clear the guest token and redirect to login, effectively "logging out" the guest session
            >
              Login
            </Button>
          ) : (
            <>
              <Button className="top-nav-logout" onClick={handleLogout}>
                Logout
              </Button>
              <Button
                type="text"
                shape="circle"
                icon={<UserOutlined />}
                className="top-nav-profile"
                onClick={handleProfileClick}
                aria-label="Profile"
              />
            </>
          )}
        </div>
      </header>
    </>
  );
};

export default Navbar;
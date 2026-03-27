"use client";

import useLocalStorage from "@/hooks/useLocalStorage";
import { UserOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { usePathname, useRouter } from "next/navigation";

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

  const handleLogout = () => {
    clearToken();
    clearUserId();
    // have to put status to offline here
    router.push("/login");
  };

  return (
    <header className="top-nav">
      <div className="top-nav-left">
        {navItems.map((item) => (
          <Button
            key={item.href}
            type={pathname === item.href ? "primary" : "text"}
            className={`top-nav-link ${pathname === item.href ? "is-active" : ""}`}
            onClick={() => router.push(item.href)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className="top-nav-right">
        <Button className="top-nav-logout" onClick={handleLogout}>
          Logout
        </Button>
        <Button
          type="text"
          shape="circle"
          icon={<UserOutlined />}
          className="top-nav-profile"
          onClick={() => router.push("/profile")}
          aria-label="Profile"
        />
      </div>
    </header>
  );
};

export default Navbar;
"use client";

import { useApi } from "@/hooks/useApi";
import useLocalStorage from "@/hooks/useLocalStorage";
import { SearchOutlined, UserOutlined } from "@ant-design/icons";
import { Button, Input, message } from "antd";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

interface UserSearchResult {
  id: number;
  username: string;
  bio: string | null;
}

const navItems = [
  { label: "Home", href: "/home" },
  { label: "Play", href: "/play" },
  { label: "History", href: "/history" },
];

const Navbar: React.FC = () => {
  const apiService = useApi();
  const router = useRouter();
  const pathname = usePathname();
  const { clear: clearToken } = useLocalStorage<string>("token", "");
  const { clear: clearUserId } = useLocalStorage<string>("userId", "");
  const [messageApi, contextHolder] = message.useMessage();
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [allUsers, setAllUsers] = useState<UserSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

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

  // Fetch all users for search
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const users = await apiService.get<UserSearchResult[]>("/users/search");
        setAllUsers(users);
      } catch (error) {
        console.error("Failed to fetch users for search:", error);
      }
    };
    fetchUsers();
  }, [apiService]);

  // Close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter users
  const filteredUsers = searchQuery.trim()
    ? allUsers.filter((user) =>
      user.username.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : [];

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setShowDropdown(e.target.value.trim().length > 0);
  };

  const isGuestUser = () => readStorageString("token").startsWith("Guest-");

  const handleProfileClick = () => {
    if (isGuestUser()) {
      messageApi.info("Guest users have limited access. Please log in to view your profile.");
      return;
    }
    router.push("/profile");
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      const userId = localStorage.getItem("userId");
      if (userId) {
        await apiService.put(`/users/${userId}`, { status: "offline" });
      }
    } catch (error) {
      console.error("Error during logout:", error);
    } finally {
      setLoading(false);
      clearToken();
      clearUserId();
      router.replace("/login");
    }
  };

  const handleGuestDeletion = async () => {
    try {
      setLoading(true);
      const userId = localStorage.getItem("userId");
      if (userId) {
        await apiService.delete(`/users/${userId}`);
      } else {
        messageApi.error("User ID not found.");
      }
    } catch (error) {
      messageApi.error("Error occurred while deleting guest user.");
    } finally {
      setLoading(false);
      router.replace("/login");
    }
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
          <button className="top-nav-logo" onClick={() => router.push("/home")}>
            <Image
              src="/UWatchIcon.png"
              alt="UWatch"
              width={40}
              height={40}
              priority
            />
          </button>
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

        <div className="top-nav-center" ref={searchContainerRef}>
          <Input
            className="user-search-input"
            placeholder="Search users..."
            prefix={<SearchOutlined />}
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => { if (searchQuery.trim()) setShowDropdown(true); }}
            allowClear
            id="user-search-field"
          />
          {showDropdown && (
            <div className="user-search-dropdown" id="user-search-dropdown">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="user-search-item"
                    onClick={() => {
                      setShowDropdown(false);
                      setSearchQuery("");
                    }}
                  >
                    <span className="user-search-item-name">{user.username}</span>
                    {user.bio && (
                      <span className="user-search-item-bio">{user.bio}</span>
                    )}
                  </div>
                ))
              ) : (
                <div className="user-search-empty">No users found</div>
              )}
            </div>
          )}
        </div>

        <div className="top-nav-right">
          {isGuest ? (
            <Button
              type="primary"
              className="top-nav-login"
              onClick={handleGuestDeletion}
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
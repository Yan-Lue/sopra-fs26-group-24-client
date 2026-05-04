"use client";

import Navbar from "@/components/Navbar";
import { useApi } from "@/hooks/useApi";
import { parseStorageValue } from "@/utils/storage";
import { DeleteOutlined, FilterOutlined, RightOutlined } from "@ant-design/icons";
import { Badge, Button, Card, Collapse, Input, Modal, Select, Typography, message } from "antd";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const { Title, Paragraph, Text } = Typography;

interface HistoryEntry {
  historyId: number;
  sessionName: string;
  sessionCode: string;
  joinedUsers: number;
  creationDate: string;
  movies: { movieId: number; score: number }[];
}

type DateFilter = "all" | "7d" | "30d" | "90d" | "1y";
type CountFilter = "any" | "1" | "2" | "3-4" | "5+";

const historyDescription =
  "Review your previous sessions and dive into the details of your movie nights. See which movies you and your friends enjoyed, check out the session summaries, and relive the fun moments. Your movie history is just a click away!";

const dateFilterOptions = [
  { value: "all", label: "All time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "1y", label: "Last year" },
];

const countFilterOptions = [
  { value: "any", label: "Any" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3-4", label: "3-4" },
  { value: "5+", label: "5+" },
];

const getCutoffDate = (filter: DateFilter) => {
  const now = new Date();
  switch (filter) {
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90d":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "1y":
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
};

const matchesCountFilter = (value: number, filter: CountFilter) => {
  switch (filter) {
    case "1":
      return value === 1;
    case "2":
      return value === 2;
    case "3-4":
      return value >= 3 && value <= 4;
    case "5+":
      return value >= 5;
    default:
      return true;
  }
};

const History: React.FC = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [histories, setHistories] = useState<HistoryEntry[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<HistoryEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [playerFilter, setPlayerFilter] = useState<CountFilter>("any");
  const [movieFilter, setMovieFilter] = useState<CountFilter>("any");

  const clearFilters = () => {
    setSearchTerm("");
    setDateFilter("all");
    setPlayerFilter("any");
    setMovieFilter("any");
  };

  const router = useRouter();
  const apiService = useApi();
  const [messageApi, contextHolder] = message.useMessage();

  const fetchHistories = useCallback(async () => {
    const userId = parseStorageValue<string | number>(localStorage.getItem("userId"));
    if (!userId) return;
    try {
      const data = await apiService.get<HistoryEntry[]>(`/users/${userId}/histories`);
      setHistories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch histories:", error);
      messageApi.error("Failed to load history.");
    }
  }, [apiService, messageApi]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userId = localStorage.getItem("userId");

    if (!token || !userId || token === "" || userId === "") {
      sessionStorage.setItem("redirectMessage", "Please log in to use this service.");
      router.replace("/login");
      return;
    }

    setIsAuthorized(true);
    void fetchHistories();
  }, [router, fetchHistories]);

  const filteredHistories = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const cutoffDate = getCutoffDate(dateFilter);

    return histories.filter((entry) => {
      const matchesSearch =
        normalizedSearch.length === 0 || entry.sessionName.toLowerCase().includes(normalizedSearch);

      const entryDate = new Date(entry.creationDate);
      const matchesDate = cutoffDate ? entryDate >= cutoffDate : true;
      const matchesPlayers = matchesCountFilter(entry.joinedUsers, playerFilter);
      const matchesMovies = matchesCountFilter(entry.movies.length, movieFilter);

      return matchesSearch && matchesDate && matchesPlayers && matchesMovies;
    });
  }, [histories, searchTerm, dateFilter, playerFilter, movieFilter]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const userId = parseStorageValue<string | number>(localStorage.getItem("userId"));
    try {
      await apiService.delete(`/users/${userId}/histories/${deleteTarget.historyId}`);
      setHistories((prev) => prev.filter((h) => h.historyId !== deleteTarget.historyId));
      messageApi.success("History entry deleted.");
    } catch (error) {
      console.error("Failed to delete history:", error);
      messageApi.error("Failed to delete history entry.");
    } finally {
      setDeleteTarget(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (!isAuthorized) {
    return null;
  }

  return (
    <>
      {contextHolder}
      <div className="page-with-nav">
        <Navbar />

        <div className="history-container">
          <div className="history-intro">
            <Title level={1}>History</Title>
            <Paragraph>{historyDescription}</Paragraph>
          </div>

          <div className="history-filters">
            <Collapse
              className="history-filters-collapse"
              defaultActiveKey={[]}
              expandIconPlacement="end"
              items={[
                {
                  key: "history-filters",
                  label: (
                    <span className="history-filter-title">
                      <FilterOutlined />
                      Filters
                      <Badge count={filteredHistories.length} overflowCount={999} className="history-filter-badge" />
                    </span>
                  ),
                  children: (
                    <div className="history-filters-panel">
                      <div className="history-filters-grid">
                        <div className="history-filter-field">
                          <Text className="history-filter-label">Session Name</Text>
                          <Input
                            allowClear
                            placeholder="Search sessions"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                        </div>

                        <div className="history-filter-field">
                          <Text className="history-filter-label">Date</Text>
                          <Select
                            value={dateFilter}
                            onChange={(value) => setDateFilter(value)}
                            options={dateFilterOptions}
                          />
                        </div>

                        <div className="history-filter-field">
                          <Text className="history-filter-label">Number of Players</Text>
                          <Select
                            value={playerFilter}
                            onChange={(value) => setPlayerFilter(value)}
                            options={countFilterOptions}
                          />
                        </div>

                        <div className="history-filter-field">
                          <Text className="history-filter-label">Number of Movies</Text>
                          <Select
                            value={movieFilter}
                            onChange={(value) => setMovieFilter(value)}
                            options={countFilterOptions}
                          />
                        </div>

                        <div className="history-filters-actions">
                          <Button
                            size="small"
                            type="text"
                            className="history-clear-filters-btn"
                            onClick={clearFilters}
                          >
                            Clear Filters
                          </Button>
                        </div>
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          </div>

          <div className="history-list">
            {filteredHistories.length === 0 ? (
              <div className="history-empty">
                <Text>
                  {histories.length === 0
                    ? "No saved sessions yet. Play a session and save it to see it here!"
                    : "No sessions match the selected filters."}
                </Text>
              </div>
            ) : (
              filteredHistories.map((entry) => (
                <Card
                  key={entry.historyId}
                  className="history-entry-card"
                  onClick={() => router.push(`/history/${entry.historyId}`)}
                >
                  <div className="history-entry-content">
                    <div className="history-entry-info">
                      <Title level={4} style={{ marginBottom: 4 }}>
                        {entry.sessionName}
                      </Title>
                      <div className="history-entry-meta">
                        <Text type="secondary">
                          {formatDate(entry.creationDate)} • {entry.joinedUsers} player{entry.joinedUsers !== 1 ? "s" : ""} • {entry.movies.length} movie{entry.movies.length !== 1 ? "s" : ""}
                        </Text>
                      </div>
                    </div>
                    <div className="history-entry-actions">
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        className="history-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(entry);
                        }}
                      />
                      <RightOutlined className="history-entry-arrow" />
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        <Modal
          open={deleteTarget !== null}
          onCancel={() => setDeleteTarget(null)}
          onOk={handleDeleteConfirm}
          title="Delete History Entry"
          okText="Delete"
          okButtonProps={{ danger: true }}
          className="history-delete-modal"
        >
          <Paragraph>
            Are you sure you want to delete the history for session &quot;{deleteTarget?.sessionName}&quot;? This action cannot be undone.
          </Paragraph>
        </Modal>
      </div>
    </>
  );
};

export default History;
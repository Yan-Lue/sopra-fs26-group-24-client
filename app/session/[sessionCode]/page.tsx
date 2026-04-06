"use client";

import { useApi } from "@/hooks/useApi";
import { Button, Card, Divider, Form, Select, Space, Spin, Tag, Typography } from "antd";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

interface SessionPutDTO {
  id: number;
  token: string;
}

interface SessionResponse {
  sessionId: number;
  sessionCode: string;
  sessionToken: string;
  hostId: number;
}

interface FilterFormValues {
  rounds: number;
  timePerRound: number;
  minRating?: number;
  releaseYear?: string;
}

const timePerRoundOptions = [
  { value: 15, label: "15s" },
  { value: 30, label: "30s" },
  { value: 45, label: "45s" },
  { value: 60, label: "1min" },
  { value: 90, label: "1min 30s" },
  { value: 120, label: "2min" },
];

const genreOptions = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Science Fiction",
  "TV Movie",
  "Thriller",
  "War",
  "Western",
];

const SessionWaitingRoom: React.FC = () => {
  const apiService = useApi();
  const router = useRouter();
  const params = useParams();
  const routeSessionCode = params.sessionCode as string;
  const [isValid, setIsValid] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [sessionCode, setSessionCode] = useState<string | undefined>(routeSessionCode);
  const [joinedUsers, setJoinedUsers] = useState(0);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [showOptionalFilters, setShowOptionalFilters] = useState(false);
  const [filterForm] = Form.useForm<FilterFormValues>();

  const roundOptions = useMemo(
    () =>
      Array.from({ length: 13 }, (_, i) => {
        const value = i + 3;
        return { value, label: `${value}` }  ;
      }),
    [],
  );

  useEffect(() => {
    const verifySessionAccess = async () => {
      const token = parseStorageValue<string>(localStorage.getItem("token"));
      const userIdRaw = parseStorageValue<string | number>(localStorage.getItem("userId"));
      const parsedUserId = Number(userIdRaw);

      if (!token || Number.isNaN(parsedUserId) || !routeSessionCode) {
        sessionStorage.setItem("redirectMessage", "Please log in to use this service.");
        router.replace("/login");
        return;
      }

      const payload: SessionPutDTO = {
        id: parsedUserId,
        token,
      };

      try {
        const session = await apiService.put<SessionResponse>(`/session/${routeSessionCode}`, payload);

        setSessionCode(session.sessionCode);
        setIsHost(session.hostId === parsedUserId);
        // Local hint only (not global)
        const key = `joinedUsers:${session.sessionCode}`;
        const hinted = Number(sessionStorage.getItem(key) ?? "1");
        setJoinedUsers(hinted);

        setIsValid(true);
      } catch (error) {
        console.error("Failed to verify session access:", error);
        alert("Failed to verify host session access.");
        router.replace("/play");
      } finally {
        setIsLoading(false);
      }
    };

    void verifySessionAccess();
  }, [apiService, routeSessionCode, router]);

  const handleGenreToggle = (genre: string, checked: boolean) => {
    setSelectedGenres((prev) => {
      const next = checked ? [...prev, genre] : prev.filter((g) => g !== genre);
      return next;
    });
  };

  const handleLeave = () => {
    if (sessionCode) {
      const key = `joinedUsers:${sessionCode}`;
      const current = Number(sessionStorage.getItem(key) ?? "1");
      const next = Math.max(current - 1, 0);

      if (next === 0) {
        sessionStorage.removeItem(key);
      } else {
        sessionStorage.setItem(key, String(next));
      }
    }
    router.replace("/home");
  };

  const parseStorageValue = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
};

  if (isLoading) {
    return (
      <div className="page-with-nav">
        
        <div className="play-container host-loading-wrap">
          <Spin size="large" />
        </div>
      </div>
    );
  }

  if (!isValid) {
    return null;
  }

  const mandatoryFilters = (
    <>
      <Typography.Title level={4} className="session-filter-group-title">
        Mandatory Filters
      </Typography.Title>

      <Form.Item
        label="Number of Rounds"
        name="rounds"
        rules={[{ required: true, message: "Please select number of rounds." }]}
      >
        <Select options={roundOptions} disabled={!isHost} />
      </Form.Item>

      <Form.Item
        label="Time Per Round"
        name="timePerRound"
        rules={[{ required: true, message: "Please select time per round." }]}
      >
        <Select options={timePerRoundOptions} disabled={!isHost} />
      </Form.Item>
    </>
  );

  const optionalFilters = (
    <div className={`optional-filters-panel ${showOptionalFilters ? "open" : ""}`}>
      <Divider className="session-filter-divider" />

      <Typography.Title level={4} className="session-filter-group-title">
        Optional Filters
      </Typography.Title>

      <Form.Item label="Genre">
        <Space size={[8, 8]} wrap>
          {genreOptions.map((genre) => (
            <Tag.CheckableTag
              key={genre}
              checked={selectedGenres.includes(genre)}
              onChange={(checked) => handleGenreToggle(genre, checked)}
              className={selectedGenres.includes(genre) ? "genre-chip active" : "genre-chip"}
            >
              {genre}
            </Tag.CheckableTag>
          ))}
        </Space>
      </Form.Item>

      <Form.Item label="Minimum Rating" name="minRating">
        <Select
          disabled={!isHost}
          options={[
            { value: 0, label: "Any rating" },
            { value: 6, label: "6+" },
            { value: 7, label: "7+" },
            { value: 8, label: "8+" },
          ]}
        />
      </Form.Item>

      <Form.Item label="Release Year" name="releaseYear">
        <Select
          disabled={!isHost}
          options={[
            { value: "any", label: "Any year" },
            { value: "2020", label: "2020+" },
            { value: "2010", label: "2010+" },
            { value: "2000", label: "2000+" },
          ]}
        />
      </Form.Item>
    </div>
  );

  return (
    <div className="page-with-nav">
      <div className="session-layout">
        {isHost && (
          <Card className="play-card host-card session-side-card" title="Host Controls">
            <Form
              form={filterForm}
              layout="vertical"
              className="session-filter-form"
              initialValues={{
                rounds: 5,
                timePerRound: 30,
                minRating: 0,
                releaseYear: "any",
              }}
            >
              {mandatoryFilters}

              <Button
                type="default"
                block
                onClick={() => setShowOptionalFilters((prev) => !prev)}
                className="optional-filters-toggle"
              >
                {showOptionalFilters ? "Hide Optional Filters" : "Show Optional Filters"}
              </Button>

              {optionalFilters}
            </Form>
          </Card>
        )}

        <Card className="play-card participant-card session-main-card" title="Waiting Room">
          <div className="waiting-room-form">
            <div className="waiting-room-center">
              <Typography.Title level={3} className="host-section-title">
                Ready to Start
              </Typography.Title>

              <Typography.Text className="host-meta-line">Session Code: {sessionCode}</Typography.Text>

              <Typography.Text className="host-meta-line">
                {joinedUsers} people have joined
              </Typography.Text>

              <div className="host-loading-wrap">
                <Spin size="large" />
              </div>

              <Typography.Text className="participant-waiting-text">
                Waiting for {isHost ? "you" : "the host"} to start the session...
              </Typography.Text>
            </div>

            <div className="waiting-room-actions">
              {isHost ? (
                <>
                  <Button className="start-session-btn" block onClick={() => console.log("Start session")}>
                    Start Session
                  </Button>
                  <Button className="end-session-btn" block onClick={() => console.log("End session")}>
                    End Session
                  </Button>
                </>
              ) : (
                <Button className="leave-session-btn" onClick={handleLeave}>
                  Leave Session
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SessionWaitingRoom;

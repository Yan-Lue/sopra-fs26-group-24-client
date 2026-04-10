"use client";

import { useApi } from "@/hooks/useApi";
import { getApiDomain } from "@/utils/domain";
import { Client } from "@stomp/stompjs";
import { CopyOutlined } from "@ant-design/icons";
import { Button, Card, Divider, Form, Select, Space, Spin, Tag, Typography, message } from "antd";
import { useParams, useRouter } from "next/navigation";
import SockJS from "sockjs-client";
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

interface SessionFilterPutDTO {
  roundLimit: number;
  genres?: string[];
  minRating?: number;
  releaseYear?: number;
}

interface LobbyUpdate {
  joinedUsers: number;
  maxPlayers: number;
}

interface MovieGetDTO {
  movieId: number;
  title: string;
  description: string;
  posterPath: string;
  rating: number;
  releaseDate: string;
  genres: string[];
}

// only in the frontend
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
  const [messageApi, contextHolder] = message.useMessage();
  const [isStarting, setIsStarting] = useState(false);
  const [sessionFilters, setSessionFilters] = useState<SessionFilterPutDTO | null>(null);

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
      const joinedSessionKey = `joinedSession:${routeSessionCode}`;
      const joinedSessionMarker = sessionStorage.getItem(joinedSessionKey);

      if (!token || Number.isNaN(parsedUserId) || !routeSessionCode) {
        sessionStorage.setItem("redirectMessage", "Please log in to use this service.");
        router.replace("/login");
        return;
      }

      if (joinedSessionMarker === `${parsedUserId}:${token}`) {
        const cachedSessionCode = routeSessionCode;
        setSessionCode(cachedSessionCode);
        setIsValid(true);
        setIsLoading(false);
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
        //mark session as joined in sessionStorage, User can join one time
        sessionStorage.setItem(joinedSessionKey, `${parsedUserId}:${token}`);
        // Local hint only (not global)
        const key = `joinedUsers:${session.sessionCode}`;
        const hinted = Number(sessionStorage.getItem(key) ?? "1");
        setJoinedUsers(hinted);

        setIsValid(true);
      } catch (error) {
        console.error("Failed to verify session access:", error);
        alert("Failed to join session. It may already be full or you may already be connected.");
        router.replace("/play");
      } finally {
        setIsLoading(false);
      }
    };

    void verifySessionAccess();
  }, [apiService, routeSessionCode, router]);

  const getSocketEndpoint = () => {
    const apiDomain = getApiDomain().replace(/\/$/, "");
    return `${apiDomain}/gs-guide-websocket`;
  };

  useEffect(() => {
    if (!isValid || !sessionCode) {
      return;
    }

    const client = new Client({
      webSocketFactory: () => new SockJS(getSocketEndpoint()),
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(
          `/topic/session/${sessionCode}/lobby`,
          (frame: { body: string }) => {
            try {
              const payload = JSON.parse(frame.body) as LobbyUpdate;
              if (typeof payload.joinedUsers === "number") {
                setJoinedUsers(payload.joinedUsers);
                sessionStorage.setItem(`joinedUsers:${sessionCode}`, String(payload.joinedUsers));
              }
            } catch (error) {
              //console.error("Failed to parse lobby update:", error);
              messageApi.error("A user left or joined, but the update could not be processed.");
            }
          },
        );

        client.subscribe(
          `/topic/session/${sessionCode}/next`,
          (frame: { body: string }) => {
            try {
              const nextMovie = JSON.parse(frame.body) as MovieGetDTO;
              sessionStorage.setItem(`currentMovie:${sessionCode}`, JSON.stringify(nextMovie));
              router.replace(`/session/${sessionCode}/vote`);
            } catch (error) {
              //console.error("Failed to parse next movie update:", error);
              messageApi.error("Failed to parse next movie update.");
            }
          },
        );
      },
      onStompError: (frame: { headers: Record<string, string> }) => {
        console.error("STOMP error:", frame.headers["message"]);
      },
    });
    client.activate();

    return () => {
      void client.deactivate();
    };
  }, [isValid, sessionCode, router]);

  // persist filters so they dont get lost after refresh
  useEffect(() => {
    if (!sessionCode || !sessionFilters) return;
    sessionStorage.setItem(`sessionFilters:${sessionCode}`, JSON.stringify(sessionFilters));
  }, [sessionCode, sessionFilters]);

  // update DTO when new genres are selected or deselected, so that backend can build the session filters
  const handleGenreToggle = (genre: string, checked: boolean) => {
    setSelectedGenres((prev) => {
      const next = checked ? [...prev, genre] : prev.filter((g) => g !== genre);

      const values = filterForm.getFieldsValue() as FilterFormValues;
      const dto = buildSessionFilterDTO(values, next);
      setSessionFilters(dto);

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

  const handleCopySessionLink = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    messageApi.success("Session link copied.");
  } catch (error) {
    console.error("Failed to copy session link:", error);
    messageApi.error("Could not copy link. Please copy from browser address bar.");
  }
};

  const parseStorageValue = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
};

// take values from form, build DTO and send to backend to build session filters
const buildSessionFilterDTO = (
  values: FilterFormValues,
  genres: string[],
): SessionFilterPutDTO => {
  const dto: SessionFilterPutDTO = {
    roundLimit: values.rounds,
  };

  if (genres.length > 0) {
    dto.genres = genres;
  }

  if (typeof values.minRating === "number" && values.minRating > 0) {
    dto.minRating = values.minRating;
  }

  if (values.releaseYear && values.releaseYear !== "any") {
    dto.releaseYear = Number(values.releaseYear);
  }

  return dto;
};

const handleStartSession = async () => {
    if (!isHost || !sessionCode) return;

    try {
      setIsStarting(true);

      await filterForm.validateFields(["rounds", "timePerRound"]);

      const values = filterForm.getFieldsValue() as FilterFormValues;
      const dto = buildSessionFilterDTO(values, selectedGenres);

      setSessionFilters(dto);

      await apiService.put(`/session/${sessionCode}/filters`, dto);

      //host triggers the first movie broadcast, participants should receive it via /topic/session/{sessionCode}/next.
      const firstMovie = await apiService.get<MovieGetDTO>(`/session/${sessionCode}/next`);
      sessionStorage.setItem(`currentMovie:${sessionCode}`, JSON.stringify(firstMovie));

      messageApi.success("Session started! Redirecting...");
      router.replace(`/session/${sessionCode}/vote`);
    } catch (error) {
      console.error("Failed to start session:", error);
      messageApi.error("Failed to start session. Please check your filter settings and try again.");
    } finally {
      setIsStarting(false);
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
      {contextHolder}
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
              onValuesChange={(_, allValues) => {
                const dto = buildSessionFilterDTO(allValues as FilterFormValues, selectedGenres);
                setSessionFilters(dto);
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

              <div className="session-code-row">
                <Typography.Text className="host-meta-line">Session Code: {sessionCode}</Typography.Text>
                <Button size="small" type="default" className="copy-link-btn" icon={<CopyOutlined />} aria-label="Copy Session Link" onClick={handleCopySessionLink}>
                </Button>
              </div>

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
                  <Button className="start-session-btn" block loading={isStarting} onClick={handleStartSession}>
                    Start Session
                  </Button>
                  <Button className="end-session-btn" block onClick={handleLeave}>
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

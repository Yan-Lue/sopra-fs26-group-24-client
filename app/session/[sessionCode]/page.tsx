"use client";

import { useApi } from "@/hooks/useApi";
import { getApiDomain } from "@/utils/domain";
import { clearSessionClientState, parseStorageValue } from "@/utils/storage";
import { CopyOutlined, UserOutlined } from "@ant-design/icons";
import { Client } from "@stomp/stompjs";
import { Button, Card, Divider, Form, Modal, Select, Space, Spin, Tag, Typography, message } from "antd";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import SockJS from "sockjs-client";

interface SessionPutDTO {
  id: number;
  token: string;
}

interface SessionResponse {
  sessionId: number;
  sessionCode: string;
  sessionToken: string;
  hostId: number;
  joinedUsers?: number;
  usernames?: string[];
  sessionName?: string;
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
  timePerRound: number;
}

interface LobbyUpdate {
  joinedUsers: number;
  maxPlayers: number;
  usernames?: string[];
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
  const [joinedUsernames, setJoinedUsernames] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [showOptionalFilters, setShowOptionalFilters] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [modal, contextHolderModal] = Modal.useModal();
  const [isStarting, setIsStarting] = useState(false);
  const hasRedirectedRef = useRef(false);
  const [sessionFilters, setSessionFilters] = useState<SessionFilterPutDTO | null>(null);
  const [showJoinedUsers, setShowJoinedUsers] = useState(false);
  const [sessionName, setSessionName] = useState<string>("Session");

  const [filterForm] = Form.useForm<FilterFormValues>();


  const roundOptions = useMemo(
    () =>
      Array.from({ length: 13 }, (_, i) => {
        const value = i + 3;
        return { value, label: `${value}` };
      }),
    [],
  );

  // helper function to handle correct redirect
  const redirectToVoteWithMovie = (movie: MovieGetDTO) => {
    if (!sessionCode || hasRedirectedRef.current) return;

    hasRedirectedRef.current = true;
    sessionStorage.setItem(`currentMovie:${sessionCode}`, JSON.stringify(movie));
    sessionStorage.setItem(`joinedUsers:${sessionCode}`, String(joinedUsers > 0 ? joinedUsers : 1));

    router.replace(`/session/${sessionCode}/vote`);
  };

  useEffect(() => {
    const verifySessionAccess = async () => {
      const token = parseStorageValue<string>(localStorage.getItem("token"));
      const userIdRaw = parseStorageValue<string | number>(localStorage.getItem("userId"));
      const parsedUserId = Number(userIdRaw);
      const joinedSessionKey = `joinedSession:${routeSessionCode}`;
      const joinedSessionMarker = sessionStorage.getItem(joinedSessionKey);

      // is the user authenticated and is there a session code in the route
      if (!token || Number.isNaN(parsedUserId) || !routeSessionCode) {
        sessionStorage.setItem("redirectMessage", "Please log in to use this service.");
        router.replace("/login");
        return;
      }

      if (joinedSessionMarker === `${parsedUserId}:${token}`) {
        const cachedSessionCode = routeSessionCode;
        setSessionCode(cachedSessionCode);
        setJoinedUsers(Number(sessionStorage.getItem(`joinedUsers:${cachedSessionCode}`) ?? "1"));

        const storedHostId = parseStorageValue<string | number>(localStorage.getItem("hostId"));
        const storedSessionCode = localStorage.getItem("sessionCode");
        if (storedSessionCode === routeSessionCode && storedHostId !== null && Number(storedHostId) === parsedUserId) {
          setIsHost(true);
        }

        const storedUsernames = sessionStorage.getItem(`joinedUsernames:${cachedSessionCode}`);
        if (storedUsernames) {
          setJoinedUsernames(JSON.parse(storedUsernames));
        }

        setSessionName(sessionStorage.getItem('sessionName') ?? "Session");

        setIsValid(true);
        setIsLoading(false);
        return;
      }

      // handles the case where user would refresh the page
      const storedHostId = parseStorageValue<string | number>(localStorage.getItem("hostId"));
      const storedSessionCode = localStorage.getItem("sessionCode");
      if (
        storedSessionCode === routeSessionCode &&
        storedHostId !== null &&
        Number(storedHostId) === parsedUserId
      ) {
        sessionStorage.setItem(joinedSessionKey, `${parsedUserId}:${token}`);
        setSessionCode(routeSessionCode);
        setIsHost(true);
        setJoinedUsers(1);

        const storedUsernamesHost = sessionStorage.getItem(`joinedUsernames:${routeSessionCode}`);
        if (storedUsernamesHost) {
          setJoinedUsernames(JSON.parse(storedUsernamesHost));
        }

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

        setSessionName(session.sessionName ?? "Session");
        setSessionCode(session.sessionCode);
        setIsHost(session.hostId === parsedUserId);
        localStorage.setItem("hostId", session.hostId.toString());
        sessionStorage.setItem(joinedSessionKey, `${parsedUserId}:${token}`);

        const actualCount = session.joinedUsers ?? 1;
        sessionStorage.setItem(`joinedUsers:${session.sessionCode}`, String(actualCount));
        setJoinedUsers(actualCount);

        if (session.usernames) {
          setJoinedUsernames(session.usernames);
          sessionStorage.setItem(`joinedUsernames:${session.sessionCode}`, JSON.stringify(session.usernames));
        }

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
  // only afrer successful session access is the user able to subscribe to websockets for real-time updates in the lobby and session
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
              if (payload.usernames) {
                setJoinedUsernames(payload.usernames);
                sessionStorage.setItem(`joinedUsernames:${sessionCode}`, JSON.stringify(payload.usernames));
              }
            } catch (error) {
              //console.error("Failed to parse lobby update:", error);
              messageApi.error("A user left or joined, but the update could not be processed.");
            }
          },
        );

        client.subscribe(
          `/topic/session/${sessionCode}/end`,
          () => {
            sessionStorage.setItem(
              "redirectInfo",
              "Session ended by host. You were redirected to the home page."
            );
            leaveLocally();
          },
        );

        client.subscribe(
          `/topic/session/${sessionCode}/next`,
          (frame: { body: string }) => {
            try {
              const nextMovie = JSON.parse(frame.body) as MovieGetDTO;
              redirectToVoteWithMovie(nextMovie);
            } catch (error) {
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

  // fallback polling for current movie in case a participant misses the websocket message when host starts the session, or if they refresh during the session
  useEffect(() => {
    if (!isValid || !sessionCode || isHost) {
      return;
    }

    let isCancelled = false;

    const pollCurrentMovie = async () => {
      if (isCancelled || hasRedirectedRef.current) return;

      try {
        const current = await apiService.get<MovieGetDTO>(
          `/session/${sessionCode}/current`
        );

        if (isCancelled || hasRedirectedRef.current) return;
        redirectToVoteWithMovie(current);
      } catch (error) {
        const apiError = error as { status?: number };
        if (apiError?.status === 409) {
          return;
        }
        if (apiError?.status === 404) {
          return;
        }
      }
    };

    void pollCurrentMovie();
    const intervalId = window.setInterval(() => {
      void pollCurrentMovie();
    }, 1500);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [apiService, isHost, isValid, sessionCode]);

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

  const redirectHomeWithMessage = (info: string) => {
    sessionStorage.setItem("redirectInfo", info);
    leaveLocally();
  };

  const handleConfirmLeave = () => {
    modal.confirm({
      className: "leave-session-confirm-modal", 
      title: "Are you sure you want to leave?",
      content: "All participants will be disconnected.",
      okText: "Yes, leave",
      okType: "primary",
      cancelText: "No, stay",
      onOk: async () => {
        await handleLeave();
        redirectHomeWithMessage("You ended the session. All participants have been disconnected.");
      },
    });
  }

  //needed, because if host ends session, the client is not correctly redirected to home and triggers infinite loop.
  const leaveLocally = () => {
    if (sessionCode) {
      clearSessionClientState(sessionCode);
    }
    router.replace("/home");
  };

  const handleLeave = async () => {
    if (sessionCode) {
      const token = parseStorageValue<string>(localStorage.getItem("token"));
      if (token) {
        try {
          await fetch(`${getApiDomain()}/session/${sessionCode}`, {
            method: "DELETE",
            headers: { "Authorization": token },
          });
        } catch (e) {
          console.error("Failed to cleanly leave session:", e);
        }
      }
    }
    leaveLocally();
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

  // take values from form, build DTO and send to backend to build session filters
  const buildSessionFilterDTO = (
    values: FilterFormValues,
    genres: string[],
  ): SessionFilterPutDTO => {
    const dto: SessionFilterPutDTO = {
      roundLimit: values.rounds,
      timePerRound: values.timePerRound,
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

      // Fallback if DTO fails
      sessionStorage.setItem(`timePerRound:${sessionCode}`, String(values.timePerRound));

      // add short delay to ensure correct redirect 
      await new Promise((resolve) => setTimeout(resolve, 1000));

      //host triggers the first movie broadcast, participants should receive it via /topic/session/{sessionCode}/next.
      const firstMovie = await apiService.get<MovieGetDTO>(`/session/${sessionCode}/next`);
      redirectToVoteWithMovie(firstMovie);
      messageApi.success("Session started! Redirecting...");
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
      {contextHolderModal}
      <div className="session-layout">
        {isHost && (
          <Card className="play-card host-card session-side-card" title="Host Controls">
            <Form
              form={filterForm}
              layout="vertical"
              className="session-filter-form"
              initialValues={{
                rounds: 5,
                timePerRound: 15,
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
                {sessionName}
              </Typography.Title>

              <div className="session-code-row">
                <Typography.Text className="host-meta-line">Session Code: {sessionCode}</Typography.Text>
                <Button size="small" type="default" className="copy-link-btn" icon={<CopyOutlined />} aria-label="Copy Session Link" onClick={handleCopySessionLink}>
                </Button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Typography.Text className="host-meta-line" style={{ margin: 0 }}>
                  {joinedUsers} {joinedUsers === 1 ? "person has" : "people have"} joined
                </Typography.Text>
                <Button
                  shape="circle"
                  icon={<UserOutlined />}
                  onClick={() => setShowJoinedUsers((prev) => !prev)}
                  aria-label="Toggle Joined Users"
                />
              </div>

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
                  <Button className="end-session-btn" block loading={isStarting} onClick={handleConfirmLeave}>
                    End Session
                  </Button>
                </>
              ) : (
                <Button className="leave-session-btn" onClick={() => handleLeave()}>
                  Leave Session
                </Button>
              )}
            </div>
          </div>
        </Card>

        {showJoinedUsers && (
          <Card className="play-card session-side-card" title="Joined Users">
            <div className="participant-settings">
              {joinedUsernames.length > 0 ? (
                joinedUsernames.map((username, i) => (
                  <Typography.Text key={i} className="host-meta-line" style={{ display: "block" }}>
                    {username}
                  </Typography.Text>
                ))
              ) : (
                <Typography.Text className="host-meta-line">No users have joined</Typography.Text>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SessionWaitingRoom;

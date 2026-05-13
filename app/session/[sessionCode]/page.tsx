"use client";

import { useApi } from "@/hooks/useApi";
import { getApiDomain } from "@/utils/domain";
import { clearSessionClientState, parseStorageValue } from "@/utils/storage";
import { CopyOutlined, ReloadOutlined, UserOutlined } from "@ant-design/icons";
import { Client } from "@stomp/stompjs";
import { Button, Card, Form, Modal, Select, Slider, Space, Spin, Tabs, Tag, Typography, message } from "antd";
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
  releaseYearRange?: [number, number];
}

interface SessionFilterPutDTO {
  roundLimit: number;
  genres?: string[];
  minRating?: number;
  minReleaseYear?: number;
  maxReleaseYear?: number;  
  timePerRound: number;
  providers?: string[];
}

interface SessionStatusGetDTO {
  joinedUsers: number;
  maxPlayers: number;
  usernames: string[];
}

interface MovieGetDTO {
  movieId: number;
  title: string;
  description: string;
  posterPath: string;
  rating: number;
  releaseDate: string;
  genres: string[];
  streamingProviders?: string[];
}

interface SessionStateGetDTO {
  sessionCode: string;
  status: "WAITING" | "PLAYING" | "ENDED" | "CANCELED";
  currentMovieIndex: number;
  currentMovie: MovieGetDTO | null;
  roundStartedAt: string | null;
  timePerRound: number;
  joinedUsers: number;
  votesReceived: number;
  totalRounds: number;
  usernames?: string[];
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

const movieProviderOptions = [
  "Netflix",
  "DisneyPlus", 
  "AppleTV",
  "AmazonPrime",
  "ParamountPlus"
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
  const [messageApi, contextHolder] = message.useMessage();
  const [modal, contextHolderModal] = Modal.useModal();
  const [isStarting, setIsStarting] = useState(false);

  const hasRedirectedRef = useRef(false);
  const wsConnectedRef = useRef(false);
  const wsConnectedAtRef = useRef<number | null>(null);
  const lastNextMessageAtRef = useRef<number | null>(null);
  const wsFallbackArmedRef = useRef(false);

  const [sessionFilters, setSessionFilters] = useState<SessionFilterPutDTO | null>(null);
  const [showJoinedUsers, setShowJoinedUsers] = useState(false);
  const [sessionName, setSessionName] = useState<string>("Session");
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [isRefreshingUsers, setIsRefreshingUsers] = useState(false);

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
  const redirectToVoteWithMovie = (movie: MovieGetDTO, stateJoinedUsers?: number) => {
    if (!sessionCode || hasRedirectedRef.current) return;

    getJoinedUsers();
    hasRedirectedRef.current = true;
    sessionStorage.setItem(`currentMovie:${sessionCode}`, JSON.stringify(movie));
    sessionStorage.setItem(`joinedUsers:${sessionCode}`, String(stateJoinedUsers ?? (joinedUsers > 0 ? joinedUsers : 1)));

    router.replace(`/session/${sessionCode}/vote`);
  };

  const applySessionState = (state: SessionStateGetDTO) => {
    if (!sessionCode || state.sessionCode !== sessionCode) return;

    if (typeof state.joinedUsers === "number" && state.joinedUsers > 0) {
      setJoinedUsers(state.joinedUsers);
      sessionStorage.setItem(`joinedUsers:${sessionCode}`, String(state.joinedUsers));
    }

    if (state.usernames) {
      setJoinedUsernames(state.usernames);
      sessionStorage.setItem(`joinedUsernames:${sessionCode}`, JSON.stringify(state.usernames));
    }

    if (state.timePerRound) {
      sessionStorage.setItem(`timePerRound:${sessionCode}`, String(state.timePerRound));
    }

    if (state.status === "PLAYING" && state.currentMovie) {
      redirectToVoteWithMovie(state.currentMovie, state.joinedUsers);
      return;
    }

    if (state.status === "CANCELED" || state.status === "ENDED") {
      sessionStorage.setItem(
        "redirectInfo",
        "Session ended by host. You were redirected to the home page."
      );
      leaveLocally();
    }
  };

  const fetchSessionState = async () => {
    if (!sessionCode) return;
    const state = await apiService.get<SessionStateGetDTO>(`/session/${sessionCode}/state`);
    applySessionState(state);
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

        setSessionName(
          sessionStorage.getItem(`sessionName:${routeSessionCode}`) ??
          sessionStorage.getItem('sessionName') ??
          "Session"
        );

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

        setSessionName(
          sessionStorage.getItem(`sessionName:${routeSessionCode}`) ??
          sessionStorage.getItem('sessionName') ??
          "Session"
        );

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

        const resolvedName = session.sessionName ?? "Session";
        setSessionName(resolvedName);
        sessionStorage.setItem(`sessionName:${session.sessionCode}`, resolvedName);
        
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
      webSocketFactory: () => new SockJS(getSocketEndpoint(), undefined, {transports: ['websocket']}),
      reconnectDelay: 5000,
      onConnect: () => {
        // Mark WebSocket as connected
        wsConnectedRef.current = true;
        wsConnectedAtRef.current = Date.now();
        wsFallbackArmedRef.current = false;

        

        client.subscribe(
          `/topic/session/${sessionCode}/state`,
          (frame: { body: string }) => {
            try {
              const state = JSON.parse(frame.body) as SessionStateGetDTO;
              applySessionState(state);
            } catch {
              void fetchSessionState();
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
          `/user/queue/current-movie`,
          (frame: { body: string }) => {
            try {
              const currentMovie = JSON.parse(frame.body) as MovieGetDTO;
              redirectToVoteWithMovie(currentMovie);
            } catch (error) {
              console.error("Failed to parse late-join movie:", error);
            }
          },
        );

        client.subscribe(
          `/topic/session/${sessionCode}/next`,
          (frame: { body: string }) => {
            try {
              // Mark that we received a /next message from WebSocket
              lastNextMessageAtRef.current = Date.now();
              const nextMovie = JSON.parse(frame.body) as MovieGetDTO;
              redirectToVoteWithMovie(nextMovie);
            } catch (error) {
              messageApi.error("Failed to parse next movie update.");
            }
            void fetchSessionState();
          },
        );
      },
      onWebSocketClose: () => {
        wsConnectedRef.current = false;
        wsFallbackArmedRef.current = true;
      },
      onWebSocketError: () => {
        wsConnectedRef.current = false;
        wsFallbackArmedRef.current = true;
      },
      onStompError: (frame: { headers: Record<string, string> }) => {
        wsConnectedRef.current = false;
        wsFallbackArmedRef.current = true;
        console.error("STOMP error:", frame.headers["message"]);
      },
    });
    client.activate();

    return () => {
      wsConnectedRef.current = false;
      void client.deactivate();
    };
  }, [isValid, sessionCode, router]);

  // persist filters so they dont get lost after refresh
  useEffect(() => {
    if (!sessionCode || !sessionFilters) return;
    sessionStorage.setItem(`sessionFilters:${sessionCode}`, JSON.stringify(sessionFilters));
  }, [sessionCode, sessionFilters]);



  // WebSocket is a fast notification path. Polling /state keeps the lobby recoverable
  // when the first websocket message is missed during subscription setup.
  useEffect(() => {
    if (!isValid || !sessionCode) {
      return;
    }

    let isCancelled = false;

    const syncState = async () => {
      if (isCancelled || hasRedirectedRef.current) return;
      try {
        await fetchSessionState();
      } catch {
        // Keep retrying; the session may still be waiting for filters/start.
      }
    };

    void syncState();
    const intervalId = window.setInterval(syncState, 2000);

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
      const dto = buildSessionFilterDTO(values, next, selectedProviders);
      setSessionFilters(dto);

      return next;
    });
  };

  // update DTO when new providers are selected or deselected, so that backend can build the session filters
  const handleProviderToggle = (provider: string, checked: boolean) => {
    setSelectedProviders((prev) => {
      const next = checked ? [...prev, provider] : prev.filter((p) => p !== provider);

      const values = filterForm.getFieldsValue() as FilterFormValues;
      const dto = buildSessionFilterDTO(values, selectedGenres, next);
      
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

  const handleToggleJoinedUsers = async () => {
    if (!sessionCode) return;

    if (showJoinedUsers) {
      setShowJoinedUsers(false);
      return;
    }

    getJoinedUsers();
    setShowJoinedUsers(true);
  };

  const getJoinedUsers = async () => {
    if (!sessionCode) return;

    try {
      const token = parseStorageValue<string>(localStorage.getItem("token"));
      if (!token) {
        messageApi.error("No authentication token found.");
        return;
      }

      const status = await apiService.getWithAuth<SessionStatusGetDTO>(`/session/${sessionCode}/users`, token);
      setJoinedUsernames(status.usernames ?? []);
      messageApi.success(`Loaded joined users.`);
    } catch (error) {
      console.error("Failed to load joined users:", error);
      messageApi.error("Could not load joined users.");
    }
  };
  
  const handleRefreshJoinedUsers = async () => {
    if (!sessionCode || isRefreshingUsers) return;

    setIsRefreshingUsers(true);
    getJoinedUsers().finally(() => {
      setIsRefreshingUsers(false);
    });
  };

  // take values from form, build DTO and send to backend to build session filters
  const buildSessionFilterDTO = (
    values: FilterFormValues,
    genres: string[],
    providers: string[],
  ): SessionFilterPutDTO => {
    const dto: SessionFilterPutDTO = {
      roundLimit: values.rounds,
      timePerRound: values.timePerRound,
    };

    if (genres.length > 0) {
      dto.genres = genres;
    }

    if (providers.length > 0) {
      dto.providers = providers;
    }

    if (typeof values.minRating === "number" && values.minRating >= 0) {
      dto.minRating = values.minRating;
    }

    if (values.releaseYearRange?.[0] && values.releaseYearRange?.[1]) {
      const [minYear, maxYear] = values.releaseYearRange;
      dto.minReleaseYear = minYear;
      dto.maxReleaseYear = maxYear;
    } 

    return dto;
  };

  const handleStartSession = async () => {
    if (!isHost || !sessionCode) return;

    try {
      setIsStarting(true);

      await filterForm.validateFields(["rounds", "timePerRound"]);

      const values = filterForm.getFieldsValue() as FilterFormValues;
      const dto = buildSessionFilterDTO(values, selectedGenres, selectedProviders);

      setSessionFilters(dto);

      await apiService.put(`/session/${sessionCode}/filters`, dto);

      // Fallback if DTO fails
      sessionStorage.setItem(`timePerRound:${sessionCode}`, String(values.timePerRound));

      // add short delay to ensure correct redirect 
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const token = parseStorageValue<string>(localStorage.getItem("token"));
      if (!token) {
        throw new Error("Missing host token");
      }

      // Host triggers the first state transition. Clients render by refetching /state.
      const firstMovie = await apiService.postWithAuth<MovieGetDTO>(`/session/${sessionCode}/advance`, {}, token);
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

  const mandatoryFiltersTab = (
    <>
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

  const optionalFiltersTab = (
    <>
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

      <Form.Item 
        label="Minimum Rating"
        name="minRating"
        valuePropName="value"
        getValueFromEvent={(value) => value}
      >
        <Slider
          disabled={!isHost}
          min={0}
          max={10}
          step={0.1}
          className="ui-slider small"
          marks={{
            0: 'Any',
            10: '10',
          }}
          tooltip={{ 
            formatter: (value) => `${value}+` 
          }}
        />
      </Form.Item>

      <Form.Item label="Release Year Range" name="releaseYearRange">
        <Slider
          range
          disabled={!isHost}
          min={1960}
          max={new Date().getFullYear()}
          step={1}
          className="ui-slider small"
          marks={{
            1960: '1960',
            [new Date().getFullYear()]: `${new Date().getFullYear()}`
          }}
          tooltip={{ 
            formatter: (value) => `${value}` 
          }}
        />
      </Form.Item>

      <Form.Item label="Providers">
        <Space size={[8, 8]} wrap>
          {movieProviderOptions.map((provider) => (
            <Tag.CheckableTag
              key={provider}
              checked={selectedProviders.includes(provider)}
              onChange={(checked) => handleProviderToggle(provider, checked)}
              className={selectedProviders.includes(provider) ? "provider-chip active" : "provider-chip"}
            >
              {provider}
            </Tag.CheckableTag>
          ))}
        </Space>
      </Form.Item>
    </>
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
                releaseYearRange: [1960, new Date().getFullYear()],
              }}
              onValuesChange={(_, allValues) => {
                const dto = buildSessionFilterDTO(allValues as FilterFormValues, selectedGenres, selectedProviders);
                setSessionFilters(dto);
              }}
            >
              <Typography.Title level={4} className="session-filter-group-title">
                Filter Settings
              </Typography.Title>

              <Tabs
                items={[
                  {
                    key: "mandatory",
                    label: "Mandatory Filters",
                    children: mandatoryFiltersTab,
                  },
                  {
                    key: "optional",
                    label: "Optional Filters",
                    children: optionalFiltersTab,
                  },
                ]}
                className="session-filter-tabs"
              />
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
                <Typography.Text className="host-meta-line">Session Code: {sessionCode?.toUpperCase()}</Typography.Text>
                <Button size="small" type="default" className="copy-link-btn" icon={<CopyOutlined />} aria-label="Copy Session Link" onClick={handleCopySessionLink}>
                </Button>
              </div>
            
            
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Typography.Text className="host-meta-line" style={{ margin: 0 }}>
                  See joined Users
                </Typography.Text>
                <Button
                  shape="circle"
                  icon={<UserOutlined />}
                  onClick={handleToggleJoinedUsers}
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
                <Button className="leave-session-btn" onClick={() => handleLeave()} loading={isLoading}>
                  Leave Session
                </Button>
              )}
            </div>
          </div>
        </Card>

        {showJoinedUsers && (
          <Card
            className="play-card session-side-card"
            title={`${joinedUsernames.length > 1 ? `${joinedUsernames.length} Users` : "1 User"} Joined `}
            extra={
              <Button
                shape="square"
                size="small"
                type="default"
                icon={<ReloadOutlined />}
                loading={isRefreshingUsers}
                onClick={handleRefreshJoinedUsers}
                aria-label="Refresh Joined Users"
              />
            }
          >
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

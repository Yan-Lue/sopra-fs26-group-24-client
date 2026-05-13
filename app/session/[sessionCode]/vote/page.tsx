"use client";

import { useApi } from "@/hooks/useApi";
import { getApiDomain } from "@/utils/domain";
import { parseStorageValue } from "@/utils/storage";
import { CloseOutlined, HeartFilled, MinusOutlined } from "@ant-design/icons";
import { Client } from "@stomp/stompjs";
import { Button, Card, Divider, Space, Spin, Tag, Typography, message } from "antd";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import SockJS from "sockjs-client";

//useRef allows us to keep track of whether we're currently advancing to the next movie, preventing multiple simultaneous advances if the timer triggers while an advance is already in progress.

/** 
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
*/

interface MovieGetDTO {
  movieId: number;
  title: string;
  description: string;
  posterPath: string;
  rating: number;
  releaseDate: string;
  genres: string[];
  similarMovies?: unknown[];
  streamingProviders?: string[];
}

interface VotePutDTO {
  userId: number;
  movieId: number;
  score: number;
  sessionCode: string;
  token: string;
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

const VotePage: React.FC = () => {
  const apiService = useApi();
  const router = useRouter();
  const params = useParams();
  const routeSessionCode = params.sessionCode as string;

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [movie, setMovie] = useState<MovieGetDTO | null>(null);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [votedMovieIds, setVotedMovieIds] = useState<number[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [timePerRound, setTimePerRound] = useState<number | null>(null);
  const [votesReceived, setVotesReceived] = useState<number>(0);
  const [joinedUsersCount, setJoinedUsersCount] = useState<number>(1);
  const [messageApi, contextHolder] = message.useMessage();
  const [isHost, setIsHost] = useState(false);
  const [hasRoundTimerStarted, setHasRoundTimerStarted] = useState(false);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [totalRounds, setTotalRounds] = useState<number | null>(null);
  const [roundStartedAt, setRoundStartedAt] = useState<string | null>(null);

  const isAdvancingRef = useRef(false);
  const isSubmittingVoteRef = useRef(false);
  const lastMovieIdRef = useRef<number | null>(null);
  const lastRoundIncrementMovieIdRef = useRef<number | null>(null);
  const currentMovieIdRef = useRef<number | null>(null);
  const stateFetchInFlightRef = useRef(false);
  const wsConnectedRef = useRef(false);
  const wsConnectedAtRef = useRef<number | null>(null);
  const lastNextMessageAtRef = useRef<number | null>(null);
  const wsFallbackArmedRef = useRef(false);

  const getMovieId = (m: MovieGetDTO | (MovieGetDTO & { id?: number }) | null): number | null => {
    if (!m) return null;
    if (typeof m.movieId === "number") return m.movieId;
    const fallback = (m as { id?: unknown }).id;
    return typeof fallback === "number" ? fallback : null;
  };

  const posterUrl = useMemo(() => {
    if (!movie?.posterPath) return "";
    if (movie.posterPath.startsWith("http")) return movie.posterPath;
    return `https://image.tmdb.org/t/p/w500${movie.posterPath}`;
  }, [movie]);

  const getSocketEndpoint = () => {
    const apiDomain = getApiDomain().replace(/\/$/, "");
    return `${apiDomain}/gs-guide-websocket`;
  };

  const calculateRemainingSeconds = (startedAt: string | null, secondsPerRound: number | null) => {
    if (!startedAt || !secondsPerRound || secondsPerRound <= 0) {
      return secondsPerRound ?? 0;
    }

    const startedMs = new Date(startedAt).getTime();
    if (Number.isNaN(startedMs)) {
      return secondsPerRound;
    }

    const elapsedSeconds = Math.floor((Date.now() - startedMs) / 1000);
    return Math.max(0, secondsPerRound - elapsedSeconds);
  };

  const applySessionState = (state: SessionStateGetDTO) => {
    if (state.sessionCode !== routeSessionCode) return;

    if (state.status === "CANCELED") {
      sessionStorage.setItem(
        "redirectInfo",
        "Session ended by host. You were redirected to the home page."
      );
      sessionStorage.removeItem(`currentMovie:${routeSessionCode}`);
      sessionStorage.removeItem(`votedMovieIds:${routeSessionCode}`);
      router.replace("/home");
      return;
    }

    if (state.status === "ENDED") {
      sessionStorage.removeItem(`currentMovie:${routeSessionCode}`);
      sessionStorage.removeItem(`votedMovieIds:${routeSessionCode}`);
      router.replace(`/session/${routeSessionCode}/results`);
      return;
    }

    if (state.status !== "PLAYING") return;

    if (typeof state.timePerRound === "number" && state.timePerRound > 0) {
      setTimePerRound(state.timePerRound);
      sessionStorage.setItem(`timePerRound:${routeSessionCode}`, String(state.timePerRound));
    }

    if (typeof state.joinedUsers === "number" && state.joinedUsers > 0) {
      setJoinedUsersCount(state.joinedUsers);
      sessionStorage.setItem(`joinedUsers:${routeSessionCode}`, String(state.joinedUsers));
    }

    if (typeof state.votesReceived === "number" && state.votesReceived >= 0) {
      setVotesReceived(state.votesReceived);
    }

    if (typeof state.totalRounds === "number" && state.totalRounds > 0) {
      setTotalRounds(state.totalRounds);
    }

    if (typeof state.currentMovieIndex === "number" && state.currentMovieIndex > 0) {
      setCurrentRound(state.currentMovieIndex);
    }

    setRoundStartedAt(state.roundStartedAt);
    setTimeRemaining(calculateRemainingSeconds(state.roundStartedAt, state.timePerRound));
    setHasRoundTimerStarted(Boolean(state.roundStartedAt));

    if (state.currentMovie) {
      const nextMovieId = getMovieId(state.currentMovie);
      const existingMovieId = currentMovieIdRef.current;
      if (nextMovieId && nextMovieId !== existingMovieId) {
        lastRoundIncrementMovieIdRef.current = nextMovieId;
        currentMovieIdRef.current = nextMovieId;
        setMovie(state.currentMovie);
        sessionStorage.setItem(`currentMovie:${routeSessionCode}`, JSON.stringify(state.currentMovie));
      }
    }
  };

  const fetchSessionState = async () => {
    if (stateFetchInFlightRef.current) return;
    stateFetchInFlightRef.current = true;
    try {
      const state = await apiService.get<SessionStateGetDTO>(`/session/${routeSessionCode}/state`);
      applySessionState(state);
    } finally {
      stateFetchInFlightRef.current = false;
    }
  };

  useEffect(() => {
    const storedVotes = parseStorageValue<number[]>(
      sessionStorage.getItem(`votedMovieIds:${routeSessionCode}`),
    );
    if (storedVotes && Array.isArray(storedVotes)) {
      setVotedMovieIds(storedVotes);
    }
    const storedJoined = sessionStorage.getItem(`joinedUsers:${routeSessionCode}`);
    if (storedJoined) {
      const parsed = Number(storedJoined);
      if (!Number.isNaN(parsed) && parsed > 0) setJoinedUsersCount(parsed);
    }
    const storedFilters = parseStorageValue<{ roundLimit?: unknown }>(
      sessionStorage.getItem(`sessionFilters:${routeSessionCode}`),
    );
    if (storedFilters && storedFilters.roundLimit) {
      const parsed = Number(storedFilters.roundLimit);
      if (!Number.isNaN(parsed) && parsed > 0) setTotalRounds(parsed);
    }
  }, [routeSessionCode]);

  useEffect(() => {
    const connectVoteSocket = async () => {
      const token = parseStorageValue<string>(localStorage.getItem("token"));
      const userIdRaw = parseStorageValue<string | number>(localStorage.getItem("userId"));
      const parsedUserId = Number(userIdRaw);

      if (!token || Number.isNaN(parsedUserId) || !routeSessionCode) {
        sessionStorage.setItem("redirectMessage", "Please log in to use this service.");
        router.replace("/login");
        return;
      }

      const storedHostIdRaw = parseStorageValue<string | number>(localStorage.getItem("hostId"));
      const storedHostId = Number(storedHostIdRaw);
      setIsHost(!Number.isNaN(storedHostId) && storedHostId === parsedUserId);

      try {
        const serverTimePerRound = await apiService.get<number>(`/session/${routeSessionCode}/time`);
        if (typeof serverTimePerRound === "number" && serverTimePerRound > 0) {
          setTimePerRound(serverTimePerRound);
          sessionStorage.setItem(`timePerRound:${routeSessionCode}`, String(serverTimePerRound));
        }
      } catch {
        // Optional fallback to local cache if request fails
        const localRaw = sessionStorage.getItem(`timePerRound:${routeSessionCode}`);
        const localValue = localRaw ? Number(localRaw) : null;
        if (localValue && localValue > 0) {
          setTimePerRound(localValue);
        }
      }

      const cachedMovie = parseStorageValue<MovieGetDTO>(
        sessionStorage.getItem(`currentMovie:${routeSessionCode}`),
      );
      if (cachedMovie) {
        currentMovieIdRef.current = getMovieId(cachedMovie);
        setMovie(cachedMovie);
      }

      const client = new Client({
        webSocketFactory: () => new SockJS(getSocketEndpoint(), undefined, { transports: ["websocket"] }),
        //built-in from stopjs, waits 0.5 seconds before trying to reconnect after connection loss (in ms)
        // --> may help with websocket instability 
        reconnectDelay: 500,
        onConnect: () => {
            // Mark WebSocket as connected and record the time of connection
            wsConnectedRef.current = true;
            wsConnectedAtRef.current = Date.now();
            wsFallbackArmedRef.current = false;

            //subcribe to vote progress updates(votes received/joined users)
            //get all votes and users and validate them before updating
            client.subscribe(
              `/topic/session/${routeSessionCode}/state`,
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
              `/topic/session/${routeSessionCode}/lobby`,
              (frame: { body: string }) => {
                try {
                  const payload = JSON.parse(frame.body) as { joinedUsers?: unknown };
                  const joinedNum = Number(payload.joinedUsers);
                  if (!Number.isNaN(joinedNum) && joinedNum > 0) {
                    setJoinedUsersCount(joinedNum);
                    try { sessionStorage.setItem(`joinedUsers:${routeSessionCode}`, String(joinedNum)); } catch {}
                  }
                } catch (err) {
                  console.error("Failed to parse lobby update in vote page:", err);
                }
              },
            );

            client.subscribe(
              `/topic/session/${routeSessionCode}/vote-progress`,
              (frame: { body: string }) => {
                try {
                  const payload = JSON.parse(frame.body) as { votesReceived?: unknown; joinedUsers?: unknown };
                  const votesNum = Number(payload.votesReceived ?? 0);
                  const joinedNum = Number(payload.joinedUsers ?? joinedUsersCount);

                  if (!Number.isNaN(votesNum) && votesNum >= 0) {
                    setVotesReceived(votesNum);
                  }
                  if (!Number.isNaN(joinedNum) && joinedNum > 0) {
                    setJoinedUsersCount(joinedNum);
                    try { sessionStorage.setItem(`joinedUsers:${routeSessionCode}`, String(joinedNum)); } catch {}
                  }
                } catch (err) {
                  console.error("Failed to parse vote-progress message:", err);
                }
              },
            );

            client.subscribe(
              `/user/queue/current-movie`,
              (frame: { body: string }) => {
                try {
                  const currentMovie = JSON.parse(frame.body) as MovieGetDTO;
                  setMovie(currentMovie);
                  sessionStorage.setItem(`currentMovie:${routeSessionCode}`, JSON.stringify(currentMovie));
                  void fetchSessionState();
                } catch (error) {
                  console.error("Failed to parse late-join movie:", error);
                }
              },
            );

          client.subscribe(
            `/topic/session/${routeSessionCode}/next`,
            () => {
              lastNextMessageAtRef.current = Date.now();
              void fetchSessionState();
            },
          );
          
          // Backend sends payload to indicate no more movies are left
          client.subscribe(`/topic/session/${routeSessionCode}/end`, (frame: { body: string }) => {
            // trim any whitespace and remove quotes
            const normalizeCode = (value: string) => value.trim().replace(/^"(.*)"$/, "$1");

            let endedSessionCode: string | null = null;
            try {
              const payload = JSON.parse(frame.body) as unknown;
              if (typeof payload === "string") {
                endedSessionCode = normalizeCode(payload);
              } else if (payload && typeof payload === "object" && "sessionCode" in payload) {
                const value = (payload as { sessionCode?: unknown }).sessionCode;
                endedSessionCode = typeof value === "string" ? value : null;
              } 
            } catch {
                endedSessionCode = normalizeCode(frame.body);
            }

            const currentSessionCode = normalizeCode(routeSessionCode);

            // prevent accidental redirect if we receive a message for a different session
            if (endedSessionCode && endedSessionCode !== currentSessionCode) {
              return;
            }

            sessionStorage.removeItem("currentMovie:" + routeSessionCode);
            sessionStorage.removeItem("votedMovieIds:" + routeSessionCode);
            router.replace(`/session/${routeSessionCode}/results`);
          });
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
          messageApi.error(`Connection error: ${frame.headers["message"]}`);
        },
      });

      client.activate();
      setIsAuthorized(true);
      setIsLoading(false);

      return client;
    };

    let activeClient: Client | undefined = undefined;
    void connectVoteSocket().then((client) => {
      activeClient = client;
    });

    return () => {
      wsConnectedRef.current = false; 
      if (activeClient) {
        void activeClient.deactivate();
      }
    };
  }, [apiService, messageApi, routeSessionCode, router]);

  useEffect(() => {
    if (!routeSessionCode || timePerRound) {
      return;
    }

    const localRaw = sessionStorage.getItem(`timePerRound:${routeSessionCode}`);
    const localValue = localRaw ? Number(localRaw) : null;
    if (localValue && localValue > 0) {
      setTimePerRound(localValue);
      return;
    }

    let cancelled = false;

    const syncTimePerRound = async () => {
      try {
        const serverTimePerRound = await apiService.get<number>(`/session/${routeSessionCode}/time`);
        if (cancelled || typeof serverTimePerRound !== "number" || serverTimePerRound <= 0) {
          return;
        }

        setTimePerRound(serverTimePerRound);
        sessionStorage.setItem(`timePerRound:${routeSessionCode}`, String(serverTimePerRound));
      } catch {
        // Retry below until the session timer can be resolved.
      }
    };

    void syncTimePerRound();
    const intervalId = setInterval(() => {
      void syncTimePerRound();
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [apiService, routeSessionCode, timePerRound]);

  // Auto-advance to next movie after timePerRound seconds
  useEffect(() => {
    if (!movie || isLoading || !timePerRound || timePerRound <= 0) {
      return;
    }

    const currentMovieId = getMovieId(movie);
    if (currentMovieId !== lastMovieIdRef.current) {
      lastMovieIdRef.current = currentMovieId;
      setTimeRemaining(calculateRemainingSeconds(roundStartedAt, timePerRound));
      setHasRoundTimerStarted(true);
    }

    const advanceToNextMovie = async () => {
      if (!isHost || isAdvancingRef.current) {
        return;
      }

      isAdvancingRef.current = true;

      try {
        const token = parseStorageValue<string>(localStorage.getItem("token"));
        if (!token) {
          throw new Error("Missing host token");
        }

        await apiService.postWithAuth<MovieGetDTO>(`/session/${routeSessionCode}/advance`, {}, token);
        await fetchSessionState();
      } catch (error) {
        const apiError = error as { status?: number };
        if (apiError?.status === 409) {
          router.replace(`/session/${routeSessionCode}/results`);
          messageApi.info("Session ended. Redirecting to results...");
          return;
        }
      } finally {
        isAdvancingRef.current = false;
      }
    };

    const intervalId = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalId);

          if (isHost && !isAdvancingRef.current) {
            void advanceToNextMovie();
          }
          return 0;
        }
        const serverRemaining = calculateRemainingSeconds(roundStartedAt, timePerRound);
        return roundStartedAt ? serverRemaining : prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [movie, isLoading, timePerRound, roundStartedAt, isHost, apiService, routeSessionCode, router, messageApi]);

  const handleVoteClick = async (vote: "x" | "skip" | "heart") => {
    //first check if movie data is loaded and if a vote submission is already in progress
    if (!movie || isSubmittingVoteRef.current || isSubmittingVote) {
      return;
    }

    const resolvedMovieId = getMovieId(movie);
    if (!resolvedMovieId) {
      messageApi.error("Movie data not ready yet. Please wait and try again.");
      return;
    }

    //frontend message to prevent multiple votes for same movei (handled in backend)
    if (votedMovieIds.includes(resolvedMovieId)) {
      messageApi.info("You already voted for this movie.");
      return;
    }

    const token = parseStorageValue<string>(localStorage.getItem("token"));
    const userIdRaw = parseStorageValue<string | number>(localStorage.getItem("userId"));
    const parsedUserId = Number(userIdRaw);

    //check if (still) logged in etc... not that crucial :)
    if (!token || Number.isNaN(parsedUserId)) {
      messageApi.error("Your session has expired. Please log in again.");
      router.replace("/login");
      return;
    }

    const scoreMap: Record<"x" | "skip" | "heart", number> = {
      x: -1,
      skip: 0,
      heart: 1,
    };

    const votePayload: VotePutDTO = {
      userId: parsedUserId,
      movieId: resolvedMovieId,
      score: scoreMap[vote],
      sessionCode: routeSessionCode,
      token,
    };

    try {
      isSubmittingVoteRef.current = true;
      setIsSubmittingVote(true);
      await apiService.post<string>(`/session/${routeSessionCode}/vote`, votePayload);
      const nextVotedMovieIds = [...votedMovieIds, resolvedMovieId];
      setVotedMovieIds(nextVotedMovieIds);
      sessionStorage.setItem(
        `votedMovieIds:${routeSessionCode}`,
        JSON.stringify(nextVotedMovieIds),
      );
      messageApi.success("Vote submitted.");
    } catch (error) {
      console.error("Failed to submit vote:", error);
      messageApi.error("Failed to submit vote. Please try again.");
    } finally {
      isSubmittingVoteRef.current = false;
      setIsSubmittingVote(false);
    }
  };

  //should prevent multiples votes for same movie 
  const currentMovieId = getMovieId(movie);
  const hasVotedCurrentMovie = currentMovieId ? votedMovieIds.includes(currentMovieId) : false;
  const hasTimedOutCurrentMovie = hasRoundTimerStarted && timeRemaining <= 0;
  const isWaitingForNextMovie = hasRoundTimerStarted && (hasVotedCurrentMovie || hasTimedOutCurrentMovie) && !isSubmittingVote;
  const displayedSeconds = Math.max(0, Math.ceil(timeRemaining));
  //as precentage for circle progress
  const timerProgress =
    typeof timePerRound === "number" && timePerRound > 0
      ? Math.max(0, Math.min(100, (displayedSeconds / timePerRound) * 100))
      : 0;
  const countdownRadius = 42;
  const countdownStroke = 8;
  const countdownCircumference = 2 * Math.PI * countdownRadius;
  const countdownOffset = countdownCircumference - (timerProgress / 100) * countdownCircumference;
  //additionally avoid 0division
  const safeJoinedUsersCount = Math.max(joinedUsersCount, 1);
  //math for circle progress of vote count
  const voteProgress = Math.max(0, Math.min(100, (votesReceived / safeJoinedUsersCount) * 100));
  const voteOffset = countdownCircumference - (voteProgress / 100) * countdownCircumference;
  const hasRoundLimit = typeof totalRounds === "number" && totalRounds > 0;
  const roundProgress = hasRoundLimit
    ? Math.max(0, Math.min(100, (currentRound / totalRounds) * 100))
    : 0;
  const roundOffset = countdownCircumference - (roundProgress / 100) * countdownCircumference;

  const showVoteProgress = votesReceived > 0;

  

  // Poll /state as the source of truth; websocket messages only wake this up faster.
  useEffect(() => {
    if (!routeSessionCode || !isAuthorized) {
      return;
    }

    let cancelled = false;

    const syncState = async () => {
      if (cancelled) return;
      try {
        await fetchSessionState();
      } catch (error) {
        console.error("Session state polling error", error);
      }
    };

    void syncState();
    const intervalId = window.setInterval(syncState, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [routeSessionCode, isAuthorized, apiService, router]);

  if (isLoading) {
    return (
      <div className="page-with-nav">
        {contextHolder}
        <div className="play-container host-loading-wrap">
          <Spin size="large" />
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }


  return (
    <div className="page-with-nav">
      {contextHolder}

      {typeof timePerRound === "number" && timePerRound > 0 && (
        <div className="vote-floating-timer" aria-live="polite">
          <div className="vote-counter-stack">
            <Typography.Text className="vote-counter-title">Timer</Typography.Text>
            <div className="vote-countdown-circle">
              <svg
                className="vote-countdown-ring"
                viewBox="0 0 100 100"
                aria-hidden="true"
                focusable="false"
              >
                <circle
                  className="vote-countdown-ring-track"
                  cx="50"
                  cy="50"
                  r={countdownRadius}
                  strokeWidth={countdownStroke}
                />
                <circle
                  className="vote-countdown-ring-progress"
                  cx="50"
                  cy="50"
                  r={countdownRadius}
                  strokeWidth={countdownStroke}
                  strokeDasharray={countdownCircumference}
                  style={{ strokeDashoffset: countdownOffset }}
                />
              </svg>
              <Typography.Text strong className="vote-countdown-seconds">
                {displayedSeconds}
              </Typography.Text>
            </div>
          </div>
        </div>
      )}

      <div className="vote-floating-right-stack" aria-live="polite">
        <div className="vote-floating-votecount">
          <div className="vote-counter-stack vote-counter-stack-votes">
            <Typography.Text className="vote-counter-title">Votes</Typography.Text>
            <div className="vote-countdown-circle">
              <svg
                className="vote-countdown-ring"
                viewBox="0 0 100 100"
                aria-hidden="true"
                focusable="false"
              >
                <circle
                  className="vote-countdown-ring-track"
                  cx="50"
                  cy="50"
                  r={countdownRadius}
                  strokeWidth={countdownStroke}
                />
                <circle
                  className="vote-countdown-ring-progress"
                  cx="50"
                  cy="50"
                  r={countdownRadius}
                  strokeWidth={countdownStroke}
                  strokeDasharray={countdownCircumference}
                  style={{ strokeDashoffset: voteOffset }}
                />
              </svg>
              <Typography.Text strong className="vote-votecount-value">
                {`${votesReceived}/${joinedUsersCount}`}
              </Typography.Text>
            </div>
          </div>
        </div>
      </div>

      <div className="play-container vote-play-container">
        <Card className="play-card vote-card">

          {!movie ? (
            <div className="host-loading-wrap vote-loading-wrap">
              <Spin size="large" />
            </div>
          ) : (
            <div className="vote-screen">
              {hasRoundLimit && (
                <div className="vote-round-indicator">
                  <Typography.Text className="vote-round-text">
                    Round {currentRound}/{totalRounds}
                  </Typography.Text>
                </div>
              )}
              <div className="vote-poster-wrap">
                {posterUrl ? (
                  <img
                    src={posterUrl}
                    alt={movie.title}
                    className="vote-poster"
                  />
                ) : (
                  <div className="vote-poster-placeholder">
                    <Typography.Text>No poster available</Typography.Text>
                  </div>
                )}
              </div>

              <div className="vote-info">
                <Typography.Title level={2} className="vote-title">
                  {movie.title}
                </Typography.Title>
             

                <Space size={[8, 8]} wrap className="vote-meta-row">
                  <Tag color="gold">Rating: {movie.rating?.toFixed(1) ?? "N/A"}</Tag>
                  <Tag color="blue">
                    {movie.releaseDate ? movie.releaseDate.slice(0, 4) : "Unknown year"}
                  </Tag>
                  {movie.genres?.map((genre) => (
                    <Tag color={"green"} key={genre}>{genre}</Tag>
                  ))}
                  <div className="vote-providers">
                    <Space size={[6, 6]} wrap>
                      {movie.streamingProviders?.length ? (
                        movie.streamingProviders.map((provider) => (
                          <Tag key={provider} color="purple">
                            {provider}
                          </Tag>
                        ))
                      ) : (
                        <Typography.Text type="secondary">
                          No streaming platform info.
                        </Typography.Text>
                      )}
                    </Space>
                  </div>
                </Space>

                <Typography.Paragraph className="vote-description">
                  {movie.description || "No description available."}
                </Typography.Paragraph>
              </div>

              <Divider />

            
              {isWaitingForNextMovie ? (
                <div className="vote-bottom-waiting">
                  <Space orientation="vertical" size={12} className="vote-waiting-stack">
                    <Typography.Title level={4} className="vote-waiting-title">
                      {hasVotedCurrentMovie ? "Your vote has been submitted!" : "Time is up for this movie."}
                    </Typography.Title>
                    <Typography.Text className="vote-saved-text">
                      {hasVotedCurrentMovie
                        ? "Waiting for other participants to vote..."
                        : "Waiting for the next movie..."}
                    </Typography.Text>
                  
                  </Space>
                </div>
              ) : (
                
                <>
                  <div className="vote-actions">
                    <Button
                      shape="circle"
                      size="large"
                      disabled={isSubmittingVote || hasVotedCurrentMovie}
                      onClick={() => void handleVoteClick("x")}
                      className="vote-action-button vote-action-x"
                      icon={<CloseOutlined />}
                      aria-label="Dislike"
                    />

                    <Button
                      shape="circle"
                      size="large"
                      disabled={isSubmittingVote || hasVotedCurrentMovie}
                      onClick={() => void handleVoteClick("skip")}
                      className="vote-action-button vote-action-skip"
                      icon={<MinusOutlined />}
                      aria-label="Skip"
                    />

                    <Button
                      shape="circle"
                      size="large"
                      disabled={isSubmittingVote || hasVotedCurrentMovie}
                      onClick={() => void handleVoteClick("heart")}
                      className="vote-action-button vote-action-heart"
                      icon={<HeartFilled />}
                      aria-label="Like"
                    />
                  </div>

                  <div className="vote-waiting-message">
                    {isSubmittingVote ? (
                      <>
                        <Spin size="small" />
                        <Typography.Text>Submitting your vote...</Typography.Text>
                      </>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default VotePage;

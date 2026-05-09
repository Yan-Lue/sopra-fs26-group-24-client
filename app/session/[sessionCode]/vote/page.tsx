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
  const isAdvancingRef = useRef(false);
  const isSubmittingVoteRef = useRef(false);
  const lastMovieIdRef = useRef<number | null>(null);
  const lastRoundIncrementMovieIdRef = useRef<number | null>(null);

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
        setMovie(cachedMovie);
      }

      const client = new Client({
        webSocketFactory: () => new SockJS(getSocketEndpoint()),
        //built-in from stopjs, waits 0.5 seconds before trying to reconnect after connection loss (in ms)
        // --> may help with websocket instability 
        reconnectDelay: 500,
        onConnect: () => {
            //subcribe to vote progress updates(votes received/joined users)
            //get all votes and users and validate them before updating
            client.subscribe(
              `/topic/session/${routeSessionCode}/vote-progress`,
              (frame: { body: string }) => {
                try {
                  const payload = JSON.parse(frame.body) as unknown;
                  if (payload && typeof payload === "object") {
                    const votes = (payload as { votesReceived?: unknown }).votesReceived;
                    const joined = (payload as { joinedUsers?: unknown }).joinedUsers;
                    const votesNum = typeof votes === "number" ? votes : Number(votes ?? 0);
                    const joinedNum = typeof joined === "number" ? joined : Number(joined ?? joinedUsersCount);
                    const validJoined = Number.isNaN(joinedNum) ? joinedUsersCount : joinedNum;
                    const validVotes = Number.isNaN(votesNum) ? 0 : votesNum;

                    setJoinedUsersCount(validJoined);

                    setVotesReceived(validVotes);

                    //persist joined users so other views can read it
                    try {
                      sessionStorage.setItem(`joinedUsers:${routeSessionCode}`, String(validJoined));
                    } catch {}
                  }
                } catch (error) {
                  console.error("Failed to parse vote-progress message:", error);
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
                } catch (error) {
                  console.error("Failed to parse late-join movie:", error);
                }
              },
            );

          client.subscribe(
            `/topic/session/${routeSessionCode}/next`,
            (frame: { body: string }) => {
              try {
                const nextMovie = JSON.parse(frame.body) as MovieGetDTO;
                setMovie(nextMovie);
                setVotesReceived(0);
                setHasRoundTimerStarted(false);
                const currentMovieId = typeof nextMovie.movieId === "number" ? nextMovie.movieId : null;
                if (currentMovieId && currentMovieId !== lastRoundIncrementMovieIdRef.current) {
                  lastRoundIncrementMovieIdRef.current = currentMovieId;
                  setCurrentRound((prev) => prev + 1);
                }
                sessionStorage.setItem(`currentMovie:${routeSessionCode}`, JSON.stringify(nextMovie));
              } catch (error) {
                console.error("Failed to parse next movie in vote page:", error);
              }
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
        //log STOMP errors to console
        onStompError: (frame: { headers: Record<string, string> }) => {
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
      setTimeRemaining(timePerRound);
      setHasRoundTimerStarted(true);
    }

    const advanceToNextMovie = async () => {
      if (!isHost || isAdvancingRef.current) {
        return;
      }

      isAdvancingRef.current = true;

      try {
        const nextMovie = await apiService.get<MovieGetDTO>(`/session/${routeSessionCode}/next`);
        setMovie(nextMovie);
        sessionStorage.setItem(`currentMovie:${routeSessionCode}`, JSON.stringify(nextMovie));
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
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [movie, isLoading, timePerRound, isHost, apiService, routeSessionCode, router, messageApi]);

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

  const showVoteProgress = votesReceived > 0;

  // Normal flow: WebSocket /topic/session/{sessionCode}/next delivers the next movie
  useEffect(() => {
    if (!routeSessionCode || isHost || !isWaitingForNextMovie) {
      return;
    }

    let cancelled = false;
    let pollTimeoutId: number | null = null;

    const startEmergencyPolling = (attemptCount = 0) => {
      if (cancelled) return;

      // Exponential backoff: 5s → 7.5s → 11.25s → 16.87s → 25s → 30s (max) suggested by Claude in case of websocket issues, should be enough to cover most instability without overwhelming the server with requests
      const delay = Math.min(5000 * Math.pow(1.5, attemptCount), 30000);

      pollTimeoutId = window.setTimeout(async () => {
        if (cancelled) return;

        try {
          const currentMovie = await apiService.get<MovieGetDTO>(
            `/session/${routeSessionCode}/current`
          );

          if (cancelled || !currentMovie) return;

          const currentMovieId = getMovieId(currentMovie);
          const existingMovieId = getMovieId(movie);
          if (currentMovieId === existingMovieId) {
            // No change; schedule next retry
            startEmergencyPolling(attemptCount + 1);
            return;
          }

          setMovie(currentMovie);
          sessionStorage.setItem(
            `currentMovie:${routeSessionCode}`,
            JSON.stringify(currentMovie)
          );
        } catch (error) {
          const apiError = error as { status?: number };

          if (apiError?.status === 409) {
            // Session ended
            sessionStorage.removeItem(`currentMovie:${routeSessionCode}`);
            sessionStorage.removeItem(`votedMovieIds:${routeSessionCode}`);
            router.replace(`/session/${routeSessionCode}/results`);
            return;
          }

          if (apiError?.status === 404) {
            console.error("Emergency polling error", error);
          }

          // Continue polling with increased backoff
          startEmergencyPolling(attemptCount + 1);
        }
      }, delay);
    };

    // Only start polling if we're still waiting after 10s (WebSocket should have delivered by then)
    const emergencyCheckId = window.setTimeout(() => {
      if (!cancelled) {
        startEmergencyPolling(0);
      }
    }, 10000);

    return () => {
      cancelled = true;
      if (pollTimeoutId) window.clearTimeout(pollTimeoutId);
      window.clearTimeout(emergencyCheckId);
    };
  }, [routeSessionCode, isHost, isWaitingForNextMovie, apiService, router, movie]);

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

      <div className="play-container">
        <Card className="play-card vote-card">

          {!movie ? (
            <div className="host-loading-wrap vote-loading-wrap">
              <Spin size="large" />
            </div>
          ) : (
            <div className="vote-screen">
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
                    <Typography.Text type="secondary">
                      Streaming Platforms:  
                    </Typography.Text>
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

            
              {typeof timePerRound === "number" && timePerRound > 0 && (
                <div className="vote-timer">
                  <Typography.Text strong>
                    Time left: {timeRemaining} second{timeRemaining === 1 ? "" : "s"}
                  </Typography.Text>
                </div>
              )}

              {totalRounds && (
                <div className="vote-round">
                  <Typography.Text>
                    Round {currentRound} / {totalRounds}
                  </Typography.Text>
                </div>
              )}

              <div className="vote-progress">
                {showVoteProgress ? (
                  <Typography.Text>
                    Voted: {votesReceived} / {joinedUsersCount}
                  </Typography.Text>
                ) : (
                  <div className="vote-placeholder" aria-hidden>
                    <Typography.Text type="secondary">Waiting for the first vote...</Typography.Text>
                  </div>
                )}
              </div>

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

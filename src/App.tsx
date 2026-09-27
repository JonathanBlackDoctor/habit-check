import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth, configured, db, login } from "./firebase";
import { firestoreRepository, type Repository } from "./repository";
import { demoRepository } from "./demo";
import {
  checkLabel,
  dateLabel,
  emptyData,
  hasPlan,
  periodLabels,
  periods,
  plannerDate,
  previousDate,
  timeOfDay,
  todayPrayers,
  visibleHabits,
  type Data,
  type Habit,
  type HabitCheck,
  type Prayer,
  type PrayerInput,
  type PrayerStatus,
} from "./model";

const GARDEN = "https://jonathanblackdoctor.github.io/habit-garden/";
function Icon({
  name,
}: {
  name: "check" | "leaf" | "prayer" | "arrow" | "plus" | "more";
}) {
  const paths = {
    check: "m5 12 4 4L19 6",
    leaf: "M20 4C10 3 3 6 4 14c1 7 13 6 16-10ZM4 20 15 9",
    prayer:
      "m8 18-3-3 5-12 2 1v9l-4 5Zm8 0 3-3-5-12-2 1v9l4 5ZM5 15l-3 5m17-5 3 5",
    arrow: "m9 5 7 7-7 7",
    plus: "M12 5v14M5 12h14",
    more: "M5 12h.01M12 12h.01M19 12h.01",
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      aria-labelledby="dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="dialog-head">
        <h2 id="dialog-title">{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="닫기">
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
function useOnline() {
  const [online, set] = useState(navigator.onLine);
  useEffect(() => {
    const f = () => set(navigator.onLine);
    window.addEventListener("online", f);
    window.addEventListener("offline", f);
    return () => {
      window.removeEventListener("online", f);
      window.removeEventListener("offline", f);
    };
  }, []);
  return online;
}
function useDate() {
  const [date, set] = useState(plannerDate());
  useEffect(() => {
    const update = () => set(plannerDate());
    const timer = setInterval(update, 15000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return date;
}
function useData(repo: Repository, date: string, retry: number) {
  const [value, set] = useState<{
    date: string;
    repo: Repository;
    data: Data;
  } | null>(null);
  useEffect(
    () => repo.subscribe(date, (data) => set({ date, repo, data })),
    [repo, date, retry],
  );
  return value?.date === date && value.repo === repo ? value.data : emptyData();
}
type Action = {
  state: "saving" | "saved" | "error";
  run: () => Promise<unknown>;
  message?: string;
};
function useActions() {
  const [actions, set] = useState<Record<string, Action>>({});
  const alive = useRef(true),
    inflight = useRef(new Set<string>());
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const run = async (key: string, fn: () => Promise<unknown>) => {
    if (inflight.current.has(key)) return false;
    inflight.current.add(key);
    set((a) => ({ ...a, [key]: { state: "saving", run: fn } }));
    try {
      await fn();
      if (alive.current)
        set((a) => ({ ...a, [key]: { state: "saved", run: fn } }));
      return true;
    } catch {
      if (alive.current)
        set((a) => ({
          ...a,
          [key]: {
            state: "error",
            run: fn,
            message: "저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요.",
          },
        }));
      return false;
    } finally {
      inflight.current.delete(key);
    }
  };
  return { actions, run };
}
export function App() {
  const demo = new URLSearchParams(location.search).get("demo") === "1";
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(!!auth && !demo),
    [error, setError] = useState("");
  useEffect(() => {
    if (demo || !auth) return;
    return onAuthStateChanged(
      auth,
      (u) => {
        setUser(u);
        setLoading(false);
      },
      () => {
        setLoading(false);
        setError("로그인 상태를 확인하지 못했어요.");
      },
    );
  }, [demo]);
  const repo = useMemo(
    () =>
      demo
        ? demoRepository()
        : user && db
          ? firestoreRepository(db, user.uid)
          : null,
    [demo, user?.uid],
  );
  if (repo)
    return (
      <Workspace
        key={demo ? "demo" : user!.uid}
        repo={repo}
        demo={demo}
        onLogout={() => {
          if (auth)
            void signOut(auth).catch(() => setError("로그아웃하지 못했어요."));
        }}
        authError={error}
      />
    );
  return (
    <main className="welcome">
      <div className="brand-mark">
        <Icon name="check" />
      </div>
      <p className="eyebrow">HABIT CHECK</p>
      <h1>
        가볍게 기록하고,
        <br />
        하루를 이어가요.
      </h1>
      <p className="welcome-copy">
        지금 할 습관과 오늘의 기도.
        <br />
        해빗가든의 기록을 이곳에서도 함께해요.
      </p>
      <div className="welcome-card">
        <Icon name="leaf" />
        <p>
          이미 쌓아온 습관 그대로.
          <br />
          <strong>같은 Google 계정으로 시작하세요.</strong>
        </p>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!configured && (
        <p className="notice">
          Firebase 연결 설정이 필요해요. 미리보기에서 화면을 먼저 살펴볼 수
          있어요.
        </p>
      )}
      <button
        className="primary wide"
        disabled={loading || !configured}
        onClick={() => {
          setError("");
          void login().catch(() =>
            setError(
              "로그인을 완료하지 못했어요. 팝업을 허용한 뒤 다시 눌러 주세요.",
            ),
          );
        }}
      >
        {loading ? "로그인 확인 중…" : "Google로 계속하기"}
      </button>
      <a className="demo-link" href="?demo=1">
        가상 데이터로 미리보기 <span>↗</span>
      </a>
      <p className="fine">습관 · 기도, 필요한 것만 간결하게.</p>
    </main>
  );
}
function Workspace({
  repo,
  demo,
  onLogout,
  authError,
}: {
  repo: Repository;
  demo: boolean;
  onLogout: () => void;
  authError: string;
}) {
  const today = useDate(),
    [yesterday, setYesterday] = useState(false),
    date = yesterday ? previousDate(today) : today;
  const [tab, setTab] = useState<"habits" | "prayers">(
      new URLSearchParams(location.search).get("view") === "prayers"
        ? "prayers"
        : "habits",
    ),
    [retry, setRetry] = useState(0),
    [account, setAccount] = useState(false);
  const online = useOnline(),
    data = useData(repo, date, retry),
    { actions, run } = useActions();
  const [planError, setPlanError] = useState(false);
  const planAttempt = useRef("");
  useEffect(() => {
    planAttempt.current = "";
    setPlanError(false);
  }, [date, retry, online]);
  useEffect(() => {
    if (
      tab !== "prayers" ||
      yesterday ||
      !online ||
      !data.ready ||
      !data.serverReady ||
      data.pending ||
      data.error ||
      hasPlan(data.day) ||
      planAttempt.current === date
    )
      return;
    planAttempt.current = date;
    void repo.ensurePlan(date, data).catch(() => {
      if (planAttempt.current === date) setPlanError(true);
    });
  }, [tab, yesterday, online, data, repo, date, retry]);
  const pending =
    Object.values(actions).some((a) => a.state === "saving") || data.pending;
  const connected = online && data.serverReady;
  const failures = Object.entries(actions).filter(
    ([, a]) => a.state === "error",
  );
  return (
    <div className="app-shell">
      {demo && (
        <div className="demo-banner">
          미리보기 · 실제 계정과 연결되지 않아요{" "}
          <a href={location.pathname}>나가기</a>
        </div>
      )}
      <header className="topbar">
        <a
          href={location.pathname + (demo ? "?demo=1" : "")}
          className="wordmark"
        >
          <span className="mini-mark">
            <Icon name="check" />
          </span>
          habit check
        </a>
        <button
          className="account-button"
          onClick={() => setAccount(true)}
          aria-label="계정 메뉴"
        >
          {demo ? "미리보기" : "내 계정"} <span>⌄</span>
        </button>
      </header>
      <main className="main-content">
        <div className="date-line">
          <span>{dateLabel(date)}</span>
          <span
            className={"sync " + (!online || pending ? "waiting" : "")}
            role="status"
          >
            {!online
              ? "오프라인"
              : pending && !data.serverReady
                ? "동기화 대기"
                : pending
                  ? "저장 중…"
                  : data.serverReady
                    ? "연결됨"
                    : "연결 확인 중…"}
          </span>
        </div>
        <div className="page-heading">
          <div>
            <p className="eyebrow">
              {tab === "habits" ? "ONE SMALL STEP" : "A MOMENT OF PRAYER"}
            </p>
            <h1>
              {tab === "habits" ? "가볍게, 하나씩." : "마음을 모으는 시간."}
            </h1>
          </div>
          <span className="heading-symbol">
            <Icon name={tab === "habits" ? "leaf" : "prayer"} />
          </span>
        </div>
        <p className="subtitle">
          {tab === "habits"
            ? "지금 할 수 있는 것부터 기록해요."
            : "오늘 떠올릴 이름과 마음을 담았어요."}
        </p>
        {tab === "habits" && (
          <div className="date-switch" aria-label="기록 날짜">
            <button
              aria-pressed={!yesterday}
              onClick={() => setYesterday(false)}
            >
              오늘
            </button>
            <button aria-pressed={yesterday} onClick={() => setYesterday(true)}>
              어제
            </button>
            {yesterday && <span>어제의 기록을 수정하고 있어요</span>}
          </div>
        )}
        {(!online || (pending && !data.serverReady)) && (
          <p className="notice" role="status">
            {pending
              ? "기기에 반영했어요. 연결되면 동기화돼요."
              : "연결되면 최신 기록을 확인할 수 있어요."}
          </p>
        )}
        {authError && (
          <p className="error" role="alert">
            {authError}
          </p>
        )}
        {data.error ? (
          <div className="error" role="alert">
            {data.error}
            <button onClick={() => setRetry((n) => n + 1)}>
              다시 불러오기
            </button>
          </div>
        ) : !data.ready ? (
          <div className="empty" role="status">
            기록을 불러오는 중이에요…
          </div>
        ) : (
          <>
            {failures.map(([key, a]) => (
              <div key={key} role="alert" className="error">
                {a.message}
                <button onClick={() => void run(key, a.run)}>다시 시도</button>
              </div>
            ))}
            {tab === "habits" ? (
              <Habits
                key={date}
                data={data}
                repo={repo}
                date={date}
                online={connected}
                actions={actions}
                run={run}
              />
            ) : (
              <Prayers
                key={today}
                data={data}
                repo={repo}
                date={today}
                online={connected}
                actions={actions}
                run={run}
                planError={planError}
                retryPlan={() => {
                  planAttempt.current = "";
                  setPlanError(false);
                  setRetry((n) => n + 1);
                }}
              />
            )}
          </>
        )}
      </main>
      <nav className="bottom-nav" aria-label="주 메뉴">
        <button
          aria-current={tab === "habits" ? "page" : undefined}
          onClick={() => setTab("habits")}
        >
          <Icon name="check" />
          습관
        </button>
        <button
          aria-current={tab === "prayers" ? "page" : undefined}
          onClick={() => {
            setYesterday(false);
            setTab("prayers");
          }}
        >
          <Icon name="prayer" />
          기도
        </button>
      </nav>
      {account && (
        <Modal
          title={demo ? "미리보기 안내" : "내 계정"}
          onClose={() => setAccount(false)}
        >
          <p className="dialog-copy">
            {demo
              ? "예시로 만든 습관과 기도제목이에요. 새로고침하면 초기화되며 실제 계정에는 저장되지 않아요."
              : "해빗가든과 같은 계정의 기록을 사용해요. 습관 설정은 해빗가든에서 변경할 수 있어요."}
          </p>
          <a
            className="secondary wide"
            href={GARDEN + "#/habits"}
            target="_blank"
            rel="noreferrer"
          >
            해빗가든 열기 ↗
          </a>
          {!demo && (
            <button
              className="text-button wide"
              onClick={() => {
                onLogout();
                setAccount(false);
              }}
            >
              로그아웃
            </button>
          )}
        </Modal>
      )}
    </div>
  );
}
type Runner = (key: string, fn: () => Promise<unknown>) => Promise<boolean>;
function SaveState({ action, online }: { action?: Action; online: boolean }) {
  return action ? (
    <span className={"save-state " + action.state} role="status">
      {action.state === "saving"
        ? online
          ? "저장 중…"
          : "동기화 대기"
        : action.state === "saved"
          ? "저장 완료"
          : "저장 실패"}
    </span>
  ) : null;
}
function Habits({
  data,
  repo,
  date,
  online,
  actions,
  run,
}: {
  data: Data;
  repo: Repository;
  date: string;
  online: boolean;
  actions: Record<string, Action>;
  run: Runner;
}) {
  const [current] = useState(timeOfDay),
    [open, setOpen] = useState<Set<string>>(() => new Set([timeOfDay()])),
    [review, setReview] = useState(
      () => new URLSearchParams(location.search).get("view") === "review",
    ),
    [reviewIds, setReviewIds] = useState<Set<string>>(
      () =>
        new Set(
          visibleHabits(data.habits)
            .filter((h) => !data.checks[h.id])
            .map((h) => h.id),
        ),
    );
  const habits = visibleHabits(data.habits);
  const beginReview = () => {
    setReviewIds(
      new Set(habits.filter((h) => !data.checks[h.id]).map((h) => h.id)),
    );
    setReview(true);
  };
  const closeButton = (
    <button className="review-button" onClick={beginReview}>
      <span>
        하루 마감 <small>빠진 기록만 차분히 확인해요</small>
      </span>
      <Icon name="arrow" />
    </button>
  );
  if (!habits.length)
    return (
      <div className="empty">
        <Icon name="leaf" />
        <h2>아직 표시할 습관이 없어요.</h2>
        <p>해빗가든에서 습관을 추가하거나 잠든 습관을 깨워 주세요.</p>
        <a
          className="secondary"
          href={GARDEN + "#/habits"}
          target="_blank"
          rel="noreferrer"
        >
          습관 관리 ↗
        </a>
      </div>
    );
  return (
    <>
      {review ? (
        <div className="section-toolbar">
          <div>
            <h2>하루 마감</h2>
            <p>방금 기록한 항목은 자리를 유지해요.</p>
          </div>
          <button className="text-button" onClick={() => setReview(false)}>
            목록으로
          </button>
        </div>
      ) : (
        <>
          {current === "night" && closeButton}
          <div className="section-toolbar">
            <span className="section-caption">나의 작은 루틴</span>
            <button
              className="text-button"
              onClick={() =>
                setOpen(new Set(open.size === 5 ? [current] : periods))
              }
            >
              {open.size === 5 ? "현재 시간대만" : "전체 보기"}
            </button>
          </div>
        </>
      )}
      {review && reviewIds.size === 0 && (
        <div className="empty">
          <Icon name="check" />
          <h2>빠진 기록이 없어요.</h2>
          <p>오늘의 기록은 여기까지. 편안히 쉬어요.</p>
        </div>
      )}
      {(review
        ? periods
        : [current, ...periods.filter((p) => p !== current)]
      ).map((period) => {
        const items = habits.filter(
          (h) => h.timeOfDay === period && (!review || reviewIds.has(h.id)),
        );
        if (!items.length) return null;
        const expanded = review || open.has(period);
        return (
          <section className="habit-group" key={period}>
            <button
              className="group-heading"
              aria-expanded={expanded}
              onClick={() =>
                setOpen((old) => {
                  const n = new Set(old);
                  n.has(period) ? n.delete(period) : n.add(period);
                  return n;
                })
              }
              disabled={review}
            >
              <span>
                {periodLabels[period]}
                {period === current && !review && <em>지금</em>}
              </span>
              <span className="group-meta">
                {items.length}개{" "}
                <span className={expanded ? "chevron expanded" : "chevron"}>
                  ⌄
                </span>
              </span>
            </button>
            {expanded && (
              <div className="habit-list">
                {items.map((h) => (
                  <HabitRow
                    key={h.id}
                    habit={h}
                    check={data.checks[h.id]}
                    action={actions[date + h.id]}
                    online={online}
                    save={(score) =>
                      void run(date + h.id, () =>
                        repo.saveHabit(date, h, score),
                      )
                    }
                    clear={() =>
                      void run(date + h.id, () => repo.clearHabit(date, h.id))
                    }
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
      {!review && (
        <>
          {current !== "night" && closeButton}
          <a
            className="manage-link"
            href={GARDEN + "#/habits"}
            target="_blank"
            rel="noreferrer"
          >
            습관 추가·편집은 해빗가든에서 <span>↗</span>
          </a>
        </>
      )}
    </>
  );
}
function HabitRow({
  habit: h,
  check,
  action,
  online,
  save,
  clear,
}: {
  habit: Habit;
  check?: HabitCheck;
  action?: Action;
  online: boolean;
  save: (score: number | null) => void;
  clear: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const busy = action?.state === "saving";
  return (
    <article className={"habit-row " + (check?.achieved ? "is-done" : "")}>
      <div className="habit-main">
        <button
          className={"check-button " + (check?.achieved ? "checked" : "")}
          disabled={busy}
          aria-label={`${h.title} ${h.scoreMode === "scaled" ? "점수 선택" : check?.score === 1 ? "기록 취소" : "완료"}`}
          aria-pressed={check?.achieved ?? false}
          onClick={() =>
            h.scoreMode === "scaled"
              ? setExpanded(!expanded)
              : check?.score === 1
                ? clear()
                : save(1)
          }
        >
          {check?.achieved ? (
            <Icon name="check" />
          ) : h.scoreMode === "scaled" && check?.score != null ? (
            <span>{check.score}</span>
          ) : null}
        </button>
        <button
          className="habit-title"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          <strong>{h.title}</strong>
          <span>
            {check
              ? checkLabel(check)
              : h.scoreMode === "scaled"
                ? "1–5점으로 기록"
                : "한 번 눌러 기록"}
            <SaveState action={action} online={online} />
          </span>
        </button>
        <button
          className="icon-button muted"
          aria-label={`${h.title} 기록 옵션`}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          <Icon name="more" />
        </button>
      </div>
      {expanded && (
        <div className="habit-options">
          {h.scoreMode === "scaled" && (
            <>
              {h.description && <p>{h.description}</p>}
              <div className="scores" aria-label={`${h.title} 점수`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    disabled={busy}
                    aria-label={`${n}점`}
                    aria-pressed={check?.score === n}
                    onClick={() => save(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="option-buttons">
            {h.scoreMode === "binary" && (
              <button disabled={busy} onClick={() => save(0)}>
                안 했음
              </button>
            )}
            <button disabled={busy} onClick={() => save(null)}>
              건너뜀
            </button>
            {check && (
              <button disabled={busy} onClick={clear}>
                기록 취소
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
function Prayers({
  data,
  repo,
  date,
  online,
  actions,
  run,
  planError,
  retryPlan,
}: {
  data: Data;
  repo: Repository;
  date: string;
  online: boolean;
  actions: Record<string, Action>;
  run: Runner;
  planError: boolean;
  retryPlan: () => void;
}) {
  const [manage, setManage] = useState(false),
    [filter, setFilter] = useState<PrayerStatus>("active"),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [form, setForm] = useState<Prayer | null | undefined>(undefined);
  const selectedPrayer = data.prayers.find((p) => p.id === selected);
  const list = manage
    ? data.prayers
        .filter(
          (p) =>
            p.status === filter &&
            [p.title, p.body, p.target, p.group].some((s) =>
              s?.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
            ),
        )
        .sort(
          (a, b) =>
            Number(b.pinned) - Number(a.pinned) ||
            (b.receivedAt?.toMillis?.() ?? 0) -
              (a.receivedAt?.toMillis?.() ?? 0) ||
            a.id.localeCompare(b.id),
        )
    : todayPrayers(data.prayers, data.day.prayerPlan);
  return (
    <>
      <div className="section-toolbar">
        <div className="view-switch">
          <button aria-pressed={!manage} onClick={() => setManage(false)}>
            오늘의 기도
          </button>
          <button aria-pressed={manage} onClick={() => setManage(true)}>
            전체 관리
          </button>
        </div>
        <button
          className="add-button"
          aria-label="기도제목 추가"
          onClick={() => setForm(null)}
        >
          <Icon name="plus" />
        </button>
      </div>
      {manage && (
        <>
          <label className="search">
            <span>검색</span>
            <input
              aria-label="기도제목 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="제목, 이름, 모임으로 검색"
            />
          </label>
          <div className="filters">
            {(["active", "answered", "dormant"] as const).map((s) => (
              <button
                key={s}
                aria-pressed={filter === s}
                onClick={() => setFilter(s)}
              >
                {
                  {
                    active: "진행 중",
                    answered: "응답됨",
                    dormant: "잠든 기도",
                  }[s]
                }
              </button>
            ))}
          </div>
        </>
      )}
      {!manage && !hasPlan(data.day) ? (
        <div className="notice" role="status">
          {planError
            ? "오늘의 기도 목록을 준비하지 못했어요."
            : !online
              ? "연결되면 오늘의 기도 목록을 준비할게요."
              : "오늘의 기도 목록을 준비하고 있어요…"}
          {planError && <button onClick={retryPlan}>다시 시도</button>}
        </div>
      ) : list.length === 0 ? (
        <div className="empty">
          <Icon name="prayer" />
          <h2>
            {manage
              ? "해당하는 기도제목이 없어요."
              : "오늘 예정된 기도를 모두 살펴봤어요."}
          </h2>
          <p>
            {manage
              ? "새 기도제목을 담거나 검색 조건을 바꿔 보세요."
              : "전체 관리에서 다른 기도제목도 볼 수 있어요."}
          </p>
        </div>
      ) : (
        <div className="prayer-list">
          {list.map((p) => (
            <article className="prayer-card" key={p.id}>
              <div className="prayer-meta">
                <span>
                  {p.group} · {p.target}
                </span>
                {p.pinned && <span className="pin-label">늘 기억하기</span>}
              </div>
              <button
                className="prayer-title"
                onClick={() => setSelected(p.id)}
              >
                <h2>{p.title}</h2>
                {p.body && <p>{p.body}</p>}
              </button>
              <div className="prayer-footer">
                <button
                  className="text-button"
                  onClick={() => setSelected(p.id)}
                >
                  자세히 보기 <span>↗</span>
                </button>
                {p.status === "active" && (
                  <button
                    className={
                      "pray-button " + (data.prayerChecks[p.id] ? "prayed" : "")
                    }
                    disabled={actions[date + p.id]?.state === "saving"}
                    aria-pressed={!!data.prayerChecks[p.id]}
                    onClick={() =>
                      void run(date + p.id, () =>
                        repo.checkPrayer(date, p.id, !data.prayerChecks[p.id]),
                      )
                    }
                  >
                    <Icon name="check" />
                    {data.prayerChecks[p.id] ? "기도했어요" : "기도하기"}
                  </button>
                )}
              </div>
              <SaveState action={actions[date + p.id]} online={online} />
            </article>
          ))}
        </div>
      )}
      {selectedPrayer && (
        <PrayerDetail
          prayer={selectedPrayer}
          repo={repo}
          busy={actions["edit" + selectedPrayer.id]?.state === "saving"}
          action={actions["edit" + selectedPrayer.id]}
          online={online}
          run={run}
          close={() => setSelected(null)}
          edit={() => {
            setForm(selectedPrayer);
            setSelected(null);
          }}
        />
      )}
      {form !== undefined && (
        <PrayerForm
          prayer={form}
          busy={actions["form"]?.state === "saving"}
          action={actions["form"]}
          online={online}
          close={() => setForm(undefined)}
          save={async (input) => {
            const ok = await run("form", () =>
              repo.savePrayer(input, form?.id),
            );
            if (ok) {
              setForm(undefined);
              setManage(true);
              setFilter(form?.status ?? "active");
              setSearch("");
            }
          }}
        />
      )}
    </>
  );
}
function PrayerForm({
  prayer,
  busy,
  action,
  online,
  close,
  save,
}: {
  prayer: Prayer | null;
  busy: boolean;
  action?: Action;
  online: boolean;
  close: () => void;
  save: (input: PrayerInput) => Promise<void>;
}) {
  const [value, set] = useState<PrayerInput>({
    title: prayer?.title ?? "",
    body: prayer?.body ?? "",
    target: prayer?.target ?? "",
    group: prayer?.group ?? "",
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value.title.trim()) void save(value);
  };
  return (
    <Modal title={prayer ? "기도제목 수정" : "기도제목 담기"} onClose={close}>
      <form onSubmit={submit} className="prayer-form">
        <label>
          기도제목
          <input
            autoFocus
            required
            maxLength={300}
            value={value.title}
            onChange={(e) => set({ ...value, title: e.target.value })}
            placeholder="어떤 마음을 기억할까요?"
          />
        </label>
        <label>
          내용 <span>선택</span>
          <textarea
            rows={4}
            maxLength={20000}
            value={value.body}
            onChange={(e) => set({ ...value, body: e.target.value })}
            placeholder="조금 더 자세히 적어도 좋아요."
          />
        </label>
        <div className="form-columns">
          <label>
            대상
            <input
              maxLength={100}
              value={value.target}
              onChange={(e) => set({ ...value, target: e.target.value })}
              placeholder="나 자신"
            />
          </label>
          <label>
            모임
            <input
              maxLength={100}
              value={value.group}
              onChange={(e) => set({ ...value, group: e.target.value })}
              placeholder="개인"
            />
          </label>
        </div>
        <SaveState action={action} online={online} />
        {action?.state === "error" && (
          <p className="error" role="alert">
            저장하지 못했어요. 다시 저장해 주세요.
          </p>
        )}
        <button className="primary wide" disabled={busy || !value.title.trim()}>
          {busy
            ? online
              ? "저장 중…"
              : "연결을 기다리고 있어요…"
            : "저장하기"}
        </button>
      </form>
    </Modal>
  );
}
function PrayerDetail({
  prayer: p,
  repo,
  busy,
  action,
  online,
  run,
  close,
  edit,
}: {
  prayer: Prayer;
  repo: Repository;
  busy: boolean;
  action?: Action;
  online: boolean;
  run: Runner;
  close: () => void;
  edit: () => void;
}) {
  const [mode, setMode] = useState<"detail" | "answer" | "delete">("detail"),
    [note, setNote] = useState("");
  const execute = async (fn: () => Promise<unknown>) => {
    if (await run("edit" + p.id, fn)) close();
  };
  return (
    <Modal
      title={
        mode === "delete"
          ? "이 기도제목을 삭제할까요?"
          : mode === "answer"
            ? "응답을 기록해요"
            : "기도제목"
      }
      onClose={close}
    >
      <p className="eyebrow">
        {p.group} · {p.target}
      </p>
      <h3 className="detail-title">{p.title}</h3>
      {mode === "delete" ? (
        <>
          <p className="dialog-copy">
            해빗가든에서도 함께 삭제돼요. 삭제한 제목은 되돌릴 수 없어요.
          </p>
          <button
            className="danger wide"
            disabled={busy}
            onClick={() => void execute(() => repo.removePrayer(p.id))}
          >
            영구 삭제
          </button>
          <button
            className="text-button wide"
            onClick={() => setMode("detail")}
          >
            돌아가기
          </button>
        </>
      ) : mode === "answer" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void execute(() => repo.answer(p.id, note));
          }}
        >
          <label className="field-label">
            응답 메모 <span>선택</span>
            <textarea
              autoFocus
              rows={5}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <button className="primary wide" disabled={busy}>
            응답 기록하기
          </button>
        </form>
      ) : (
        <>
          <p className="detail-body">
            {p.body || "기억하고 싶은 마음을 담아 기도해요."}
          </p>
          {p.status === "answered" && (
            <div className="answer-note">
              <strong>응답의 기록</strong>
              <p>{p.answerNote || "응답된 기도제목이에요."}</p>
            </div>
          )}
          <div className="detail-actions">
            <button className="secondary" onClick={edit}>
              수정
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                void execute(() =>
                  repo.updatePrayer(p.id, { pinned: !p.pinned }),
                )
              }
            >
              {p.pinned ? "고정 해제" : "늘 기억하기"}
            </button>
            {p.status === "active" && (
              <button className="primary" onClick={() => setMode("answer")}>
                응답 기록
              </button>
            )}
            {p.status === "dormant" && (
              <button
                className="primary"
                disabled={busy}
                onClick={() => void execute(() => repo.awaken(p.id))}
              >
                다시 기도하기
              </button>
            )}
          </div>
          <button className="delete-link" onClick={() => setMode("delete")}>
            기도제목 삭제
          </button>
        </>
      )}
      <SaveState action={action} online={online} />
      {action?.state === "error" && (
        <p className="error" role="alert">
          변경하지 못했어요. 다시 시도해 주세요.
        </p>
      )}
    </Modal>
  );
}

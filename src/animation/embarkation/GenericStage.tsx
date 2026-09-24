import type { MusterProjection } from "@/muster/contracts";
import { Compass, Crown } from "@/components/muster/icons";
import { MusterAvatar } from "@/components/muster/MusterAvatar";

export function GenericStage({
  room,
  ready,
  onBegin,
}: {
  room: MusterProjection;
  ready: boolean;
  onBegin: () => void;
}) {
  const crew = room.crew.filter(
    (m) => m.isCaptain || !["LEFT", "REMOVED", "CANCELLED", "COMPLETED_MEMBER"].includes(m.status),
  );
  return (
    <div className="embarkation-source" data-testid="embarkation-stage">
      <header className="embarkation-brand" data-departure>
        <Compass size={33} />
        <span>
          Voyagewright<small>STORIES MADE TO BE PLAYED</small>
        </span>
      </header>
      <div className="embarkation-bearing" data-departure aria-hidden="true" />
      <section className="embarkation-invitation">
        <div data-departure="invitation">
          <p className="embarkation-eyebrow">{room.voyage.title}</p>
          <h1 data-departure="focus-title">Join the adventure</h1>
          <p className="embarkation-invitation-copy">
            You’re on the crew for {room.voyage.title}. A new horizon awaits.
          </p>
        </div>
        <ul className="embarkation-source-crew" aria-label="Your crew">
          {crew.map((m) => (
            <li key={m.id} data-departure>
              {m.isCaptain && <Crown className="embarkation-crown" size={17} />}
              <MusterAvatar name={m.displayName} url={m.avatarUrl} />
              <strong>{m.displayName}</strong>
              <small>
                {m.isCaptain ? "Captain" : "Crew"}
                {m.isCurrentPlayer ? " · You" : ""}
              </small>
              <span>
                <i data-ready={m.ready} />
                {m.status === "INVITED"
                  ? "Invited"
                  : !m.participates
                    ? "Captain only"
                    : m.ready
                      ? "Ready"
                      : "Preparing"}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <aside className="embarkation-source-chronicle" data-departure>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={room.voyage.coverUrl} alt={`${room.voyage.title} Chronicle artwork`} />
        <h2>{room.voyage.title}</h2>
        {room.voyage.subtitle && <p className="embarkation-subtitle">{room.voyage.subtitle}</p>}
        {room.voyage.description && <p>{room.voyage.description}</p>}
        <dl>
          <div>
            <dt>Edition</dt>
            <dd>{room.voyage.edition}</dd>
          </div>
          <div>
            <dt>Voyage</dt>
            <dd>{room.voyage.voyageName}</dd>
          </div>
          <div>
            <dt>Captain</dt>
            <dd>{room.voyage.captainName}</dd>
          </div>
          {room.voyage.duration !== null && (
            <div>
              <dt>Estimated duration</dt>
              <dd>{room.voyage.duration} minutes</dd>
            </div>
          )}
        </dl>
      </aside>
      <div className="embarkation-begin" data-departure>
        <button disabled={!ready} onClick={onBegin}>
          <Compass size={24} />
          <span>JOIN THE ADVENTURE</span>
          <span aria-hidden="true">→</span>
        </button>
        <p>{ready ? "Your crew. A new horizon." : "Preparing your arrival…"}</p>
      </div>
    </div>
  );
}

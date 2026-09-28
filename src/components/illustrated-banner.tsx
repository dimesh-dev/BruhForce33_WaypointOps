import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

type BannerProps = {
  image: string;
  eyebrow: string;
  title: string;
  accent: string;
  description: string;
  className?: string;
};
export function IllustratedBanner({
  image,
  eyebrow,
  title,
  accent,
  description,
  className = "",
}: BannerProps) {
  return (
    <section className={`illustrated-banner ${className}`}>
      <Image
        width={1536}
        height={1024}
        sizes="(max-width: 700px) 100vw, 800px"
        src={`/images/${image}.png`}
        alt=""
        className="banner-art"
      />
      <div className="banner-paper" />
      <div className="banner-copy">
        <span className="eyebrow">
          <i />
          {eyebrow}
        </span>
        <h2>
          {title}
          <br />
          <em>{accent}</em>
        </h2>
        <p>{description}</p>
      </div>
      <span className="art-edition">
        THE WAYPOINT JOURNAL <span>·</span> FIELD NOTES, NO. 01
      </span>
    </section>
  );
}
export function JourneyCards({
  onSelect,
}: {
  onSelect: (role: "Loader" | "Driver" | "Store manager") => void;
}) {
  const cards = [
    {
      role: "Loader" as const,
      image: "loading-dock",
      number: "01",
      label: "AT THE DOCK",
      title: "A considered beginning.",
      caption: "Every crate. The right place.",
    },
    {
      role: "Driver" as const,
      image: "on-the-road",
      number: "02",
      label: "ON THE ROAD",
      title: "A little further, together.",
      caption: "Confidence at every turn.",
    },
    {
      role: "Store manager" as const,
      image: "neighborhood-store",
      number: "03",
      label: "AT YOUR DOOR",
      title: "The moment it all arrives.",
      caption: "From our people to yours.",
    },
  ];
  return (
    <section className="journey-section">
      <div className="section-editorial">
        <div>
          <span className="eyebrow">PEOPLE MAKE THE DIFFERENCE</span>
          <h2>
            One journey. <em>Many hands.</em>
          </h2>
        </div>
        <p>
          A connected experience for every
          <br />
          person along the way.
        </p>
      </div>
      <div className="journey-card-grid">
        {cards.map((c) => (
          <button
            key={c.role}
            className="illustrated-journey-card"
            onClick={() => onSelect(c.role)}
          >
            <div className="journey-art">
              <Image
                width={1536}
                height={1024}
                sizes="(max-width: 700px) 100vw, 800px"
                src={`/images/${c.image}.png`}
                alt=""
                loading="lazy"
              />
              <span>{c.number}</span>
            </div>
            <div className="journey-card-copy">
              <small>{c.label}</small>
              <h3>{c.title}</h3>
              <p>{c.caption}</p>
              <span className="journey-arrow">
                <ArrowUpRight size={20} />
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

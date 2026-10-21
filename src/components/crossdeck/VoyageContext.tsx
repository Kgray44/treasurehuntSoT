export type VoyageContextData = {
  voyageId: string;
  versionId: string;
  title: string;
};

/** The authorized Journal's human context, carried into its active presentation. */
export function VoyageContext({ voyage, heading = false }: { voyage: VoyageContextData; heading?: boolean }) {
  const Title = heading ? "h1" : "strong";
  return (
    <section
      aria-label="Voyage context"
      data-experience-voyage={voyage.voyageId}
      data-experience-version={voyage.versionId}
    >
      <small>Voyage</small>
      {!heading && <br />}
      <Title>{voyage.title}</Title>
    </section>
  );
}

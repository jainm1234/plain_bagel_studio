import type { Metadata } from "next";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "chatting on the 5th floor of the moma — plain bagel studios",
};

export default function ChattingOnTheFifthFloorPage() {
  return (
    <main className="publication article">
      <Header />
      <article className="article-content">
        <h1>chatting on the 5th floor of the moma</h1>

        <p>
          4th of July in NYC
          <br />
          <br />
          It is 100 degrees. The city is empty.
        </p>

        <p>It&apos;s just me and you.</p>

        <p>Strangely lacking the need to work this weekend.</p>

        <p>
          This means getting a coffee to stay and sketching ideas from the week
          in the basement of Thayer.
        </p>

        <p>
          When inspiration dwindles, the day poses its question: what shall we
          do?
        </p>

        <p>We go to a museum.</p>

        <p>
          You know all about the artists. I do not. I&apos;ve always appreciated
          art and enjoyed trying to recreate some of my favorites: Rothko,
          Basquiat, and Mondrian.
        </p>

        <p>
          At museums and galleries, my attention is split. I find myself equally
          curious about the artists as I am about the collectors.
        </p>

        <p>
          Financiers, entrepreneurs, heirs, and heiresses. The stories of the
          collectors are always fascinating. I love to share them with you.
        </p>

        <p>
          It&apos;s my version of Guy Raz&apos;s &ldquo;How I Built This,&rdquo;
          your favorite podcast.
        </p>

        <p>
          Ken Griffin, Henry Kravis, and David Geffen are today&apos;s
          collectors.
        </p>

        <p>
          I share how Griffin started Citadel when he was 22, and how it&apos;s
          now the largest hedge fund in the world. How Kravis invented the
          leveraged buyout, which birthed the private equity industry. And how
          Geffen forged his UCLA diploma to keep his job at William Morris, then
          went on to manage John Lennon, Nirvana, Cher, and Aerosmith, and
          create DreamWorks later in his career.
        </p>

        <p className="speaker-break">&mdash;</p>

        <p>
          I chuckle. &ldquo;You are crazy (in the best way).&rdquo; My cup is
          full of creative and entrepreneurial inspiration. It is crazy to hear
          about and see these masterpieces and empires that people make, and
          hearing their stories makes everything make sense. I wonder how much of
          their life made sense while they were living it, which moments were
          the ones where everything was about to happen. And then I wonder what
          my story is. I wonder if I was too late for my story. Luke tells me my
          story. Maybe it is easier to tell the stories of other people. I think
          it is impossible to be too late for your own story. I feel better. We
          head home from the MoMA, itching to make something.
        </p>

        <p>
          The air feels heavy and the sun touches every corner of our studio
          apartment. The heat wave wraps around everything and highlights the
          deep red wooden shelves and cabinets. We sit on the bed in our
          underwear eating pizza. We both take a deep breath. The AC is finally
          starting to spit out cool air. I pull out my computer and proclaim it
          is time for our first publication entry. The city is empty and feels
          slow for the first time. We break the silence as we chat and giggle.
        </p>

        <p className="sign-off">
          xoxo
          <br />
          luke and malvika
        </p>
      </article>
    </main>
  );
}

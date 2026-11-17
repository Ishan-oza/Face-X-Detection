import { Github, Linkedin, Mail } from 'lucide-react';
import type { TeamMember } from '../../data/project';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((p) => p.length > 1)
    .slice(0, 2)
    .map((p) => p[0])
    .join('');

const iconLink =
  'flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-mist transition-all duration-300 ease-out-expo hover:-translate-y-0.5 hover:border-signal/50 hover:bg-signal/10 hover:text-signal active:scale-95';

export function TeamCard({ member }: { member: TeamMember }) {
  return (
    <article className="panel card-hover group flex h-full flex-col p-6">
      <span
        aria-hidden
        className="flex h-12 w-12 items-center justify-center rounded-full border border-signal/30 bg-signal/10 font-display text-xl text-signal transition-colors duration-300 group-hover:border-signal/60 group-hover:bg-signal/15"
      >
        {initials(member.name)}
      </span>
      <h3 className="display mt-5 text-[28px] leading-tight">{member.name}</h3>
      <a
        href={`mailto:${member.email}`}
        className="mt-1.5 truncate font-mono text-[11.5px] text-mist transition-colors hover:text-signal"
      >
        {member.email}
      </a>
      <ul className="mt-6 flex gap-2 border-t hairline pt-5" aria-label={`Contact ${member.name}`}>
        <li>
          <a href={`mailto:${member.email}`} className={iconLink} aria-label={`Email ${member.name}`} title="Email">
            <Mail aria-hidden className="h-4 w-4" />
          </a>
        </li>
        <li>
          <a
            href={member.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className={iconLink}
            aria-label={`${member.name} on LinkedIn (opens in a new tab)`}
            title="LinkedIn"
          >
            <Linkedin aria-hidden className="h-4 w-4" />
          </a>
        </li>
        <li>
          <a
            href={member.github}
            target="_blank"
            rel="noopener noreferrer"
            className={iconLink}
            aria-label={`${member.name} on GitHub (opens in a new tab)`}
            title="GitHub"
          >
            <Github aria-hidden className="h-4 w-4" />
          </a>
        </li>
      </ul>
    </article>
  );
}

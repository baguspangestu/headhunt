import clsx from 'clsx';
import { CloudflareImage } from '@/components/ui/CloudflareImage';

type TypeCardProps = {
  hash: string;
  name: string;
  icons: IconItem[];
  rarityCounts?: { r5: number; r6: number };
  pity5: number;
  pity6: number;
  pity5Limit: number;
  pity6Limit: number;
  isSelected: boolean;
};

type IconItem = {
  name: string;
  url: string;
};

export const TypeCard = ({
  hash,
  name,
  icons,
  rarityCounts,
  pity5,
  pity6,
  pity5Limit,
  pity6Limit,
  isSelected,
}: TypeCardProps) => {
  const borderColor = isSelected
    ? 'border-yellow-500 bg-neutral-700/80'
    : 'border-transparent bg-neutral-800/80';

  const content = (
    <>
      <div className="flex shrink-0 items-end bg-neutral-900/35">
        {hash === 'weponbox' ? (
          <div
            className={`grid h-25 w-25 place-items-center ${icons.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}
          >
            {icons.map((icon, index) => (
              <CloudflareImage
                key={index}
                src={icon.url}
                alt={icon.name}
                width={icons.length === 1 ? 100 : 50}
                height={icons.length === 1 ? 100 : 50}
                draggable={false}
                className={
                  icons.length === 3 && index === 2 ? 'col-span-2' : undefined
                }
              />
            ))}
          </div>
        ) : hash === 'joint' ? (
          <div className="relative grid h-25 w-25 grid-cols-2">
            {icons.map((icon, index) => (
              <CloudflareImage
                key={index}
                src={icon.url}
                alt={icon.name}
                width={50}
                height={50}
                draggable={false}
              />
            ))}
          </div>
        ) : (
          <div className="relative h-25 w-25">
            <CloudflareImage
              src={icons[0].url}
              alt={icons[0].name}
              width={100}
              height={100}
              draggable={false}
              className="absolute inset-0"
            />
            {icons.length > 1 && (
              <div className="absolute right-0 bottom-0 left-0 flex justify-center gap-2">
                {icons.slice(1).map((icon, index) => (
                  <CloudflareImage
                    key={index}
                    src={icon.url}
                    alt={icon.name}
                    width={32}
                    height={32}
                    draggable={false}
                    className="rounded-full"
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 py-1.5 pr-3 pl-2">
        <div className="flex flex-1 flex-col justify-between gap-1">
          <p className="line-clamp-2 leading-tight font-bold">{name}</p>
          <div className="flex flex-col">
            <div className="flex items-center justify-between gap-3 text-[#FF8A32]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/rarity_6.png"
                alt={'6★'}
                width={54}
                height={29}
                draggable={false}
                className="w-8"
              />
              <div className="text-sm font-semibold tabular-nums">
                {rarityCounts
                  ? `×${rarityCounts.r6}`
                  : `${pity6}/${pity6Limit}`}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 text-[#FFD036]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/rarity_5.png"
                alt={'5★'}
                width={54}
                height={29}
                draggable={false}
                className="w-8"
              />
              <div className="text-sm font-semibold tabular-nums">
                {rarityCounts
                  ? `×${rarityCounts.r5}`
                  : `${pity5}/${pity5Limit}`}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  if (hash === 'rerun') {
    return (
      <div className="flex min-h-25 overflow-hidden rounded-xl bg-neutral-800/80">
        {content}
      </div>
    );
  }

  return (
    <a
      className={clsx(
        'relative flex min-h-25 overflow-hidden rounded-xl border-2 transition-colors duration-200 hover:bg-neutral-700/80 focus-visible:ring-2 focus-visible:ring-yellow-300 focus-visible:outline-hidden',
        borderColor
      )}
      href={`#${hash}`}
      aria-current={isSelected ? 'page' : undefined}
    >
      {content}
    </a>
  );
};

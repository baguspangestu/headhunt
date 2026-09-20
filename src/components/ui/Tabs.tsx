'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

type TabsProps = {
  tabs: string[];
  children: ReactNode[];
  defaultActiveIndex?: number;
  resetKey?: unknown;
};

export const Tabs = ({
  tabs,
  children,
  defaultActiveIndex = 0,
  resetKey,
}: TabsProps) => {
  const [active, setActive] = useState(defaultActiveIndex);
  const baseId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setActive(Math.min(Math.max(defaultActiveIndex, 0), tabs.length - 1));
  }, [defaultActiveIndex, resetKey, tabs.length]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();

    let next = active;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (event.key === 'ArrowLeft')
      next = (active - 1 + tabs.length) % tabs.length;
    if (event.key === 'ArrowRight') next = (active + 1) % tabs.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="w-full">
      <div
        role="tablist"
        aria-label="Platform"
        onKeyDown={handleKeyDown}
        className="mb-4 flex scrollbar-none gap-1.5 overflow-x-auto overscroll-x-contain rounded-xl bg-neutral-950/50 p-1.5 [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            id={`${baseId}-tab-${index}`}
            type="button"
            role="tab"
            aria-selected={active === index}
            aria-controls={`${baseId}-panel-${index}`}
            tabIndex={active === index ? 0 : -1}
            onClick={() => setActive(index)}
            className={`min-w-max flex-1 cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold outline-hidden transition-all focus-visible:ring-2 focus-visible:ring-yellow-400/70 sm:text-sm ${
              active === index
                ? 'bg-yellow-500 text-neutral-950 shadow-xs shadow-yellow-950/30'
                : 'text-white/55 hover:bg-white/7 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {children.map((child, index) => (
        <div
          key={tabs[index]}
          id={`${baseId}-panel-${index}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${index}`}
          hidden={active !== index}
          tabIndex={0}
          className="outline-hidden"
        >
          {child}
        </div>
      ))}
    </div>
  );
};

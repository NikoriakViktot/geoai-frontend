import { useEffect, useState } from "react";

export function useActiveSection(
    ids: string[],
    rootMargin = "-45% 0px -50% 0px"
){
    const [active, setActive] = useState<string>(ids[0] ?? "");

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                for (const { isIntersecting, target } of entries) {
                    if (isIntersecting) {
                        // target: Element → має .id за визначенням DOM
                        setActive(target.id);
                    }
                }
            },
            { root: null, rootMargin, threshold: 0.01 }
        );

        const elements = ids
            .map((id) => document.getElementById(id))
            .filter((el): el is HTMLElement => el !== null); // ← ключова правка

        elements.forEach((el) => observer.observe(el));

        return () => observer.disconnect();
    }, [ids, rootMargin]);

    return active;
}

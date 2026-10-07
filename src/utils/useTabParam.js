import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { setCurrentSub } from './navTrail';

/**
 * A page's current tab, kept in the address (…/finance?tab=expenses) instead of only in memory:
 *   • Back / Forward (browser, or the Back button in the top bar) step through the tabs visited
 *   • refreshing keeps you on the same tab, and a tab can be bookmarked or shared
 * labels: { tabKey: 'Expenses' } — shown on the Back button of the next page ("Back to Finance · Expenses").
 */
export function useTabParam(defaultTab, labels, param = 'tab') {
    const [params, setParams] = useSearchParams();
    const tab = params.get(param) || defaultTab;
    const setTab = useCallback((next) => {
        const current = params.get(param) || defaultTab;
        if (!next || next === current) return;
        const p = new URLSearchParams(params);
        if (next === defaultTab) p.delete(param); else p.set(param, next);
        setParams(p);
    }, [params, setParams, defaultTab, param]);
    useEffect(() => { setCurrentSub(labels ? labels[tab] : undefined); }, [tab, labels]);
    return [tab, setTab];
}

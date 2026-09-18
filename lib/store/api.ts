import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

type BtcPriceResponse = { quote: { price: number } | null };
type SpxPriceResponse = { quote: { price: number } | null };
type RegimeResponse = { globalRegime: "bull" | "bear" | "lateral" | null };
type UnreadCountResponse = { count: number };

/**
 * Single RTK Query layer for the header/sidebar polling data. Header and Sidebar both
 * needed the unread alert count before this — each ran its own useEffect/fetch/setInterval,
 * so mounting both fired duplicate requests. RTK Query subscribes both components to the
 * same cached query, so one poll serves both.
 */
export const dashboardApi = createApi({
  reducerPath: "dashboardApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api" }),
  endpoints: (builder) => ({
    getBtcPrice: builder.query<BtcPriceResponse, void>({
      query: () => "btc-price",
    }),
    getSpxPrice: builder.query<SpxPriceResponse, void>({
      query: () => "spx-price",
    }),
    getRegime: builder.query<RegimeResponse, void>({
      query: () => "regime",
    }),
    getUnreadAlertsCount: builder.query<UnreadCountResponse, void>({
      query: () => "alerts/unread-count",
    }),
  }),
});

export const { useGetBtcPriceQuery, useGetSpxPriceQuery, useGetRegimeQuery, useGetUnreadAlertsCountQuery } =
  dashboardApi;

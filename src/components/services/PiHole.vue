<template>
  <Generic :item="item" :subtitle="subtitle" :status="status" />
</template>

<script>
import service from "@/mixins/service.js";
import { displayPercent } from "@/utils/format.js";

const BLOCKING_STATE = {
  enabled: "online",
  disabled: "warning",
  failed: "warning",
  unknown: "unknown",
};

export default {
  name: "PiHole",
  mixins: [service],
  data: () => ({
    blocking: null,
    percent_blocked: null,
    serverError: null,
    sessionId: null,
    sessionExpiry: null,
    retryCount: 0,
    maxRetries: 3,
    retryDelay: 5000,
  }),
  computed: {
    status: function () {
      if (this.serverError || !this.blocking) {
        return this.reachabilityStatus();
      }
      return { state: BLOCKING_STATE[this.blocking], label: this.blocking };
    },
    subtitle: function () {
      if (this.serverError) {
        return null;
      }
      const percent =
        this.percent_blocked !== null && this.percent_blocked >= 0
          ? displayPercent(Number(this.percent_blocked))
          : null;
      return percent && `${percent} blocked`;
    },
    isAuthenticated() {
      return (
        this.sessionId && this.sessionExpiry && Date.now() < this.sessionExpiry
      );
    },
  },
  created() {
    if (parseInt(this.item.apiVersion, 10) === 6) {
      this.loadCachedSession();

      // Set up auto-update method for the scheduler
      this.autoUpdateMethod = this.fetchStatus;
    } else {
      // Set up auto-update method for the scheduler
      this.autoUpdateMethod = this.fetchStatus_v5;
    }
    // Initial data fetch
    this.autoUpdateMethod();
  },
  methods: {
    loadCachedSession: function () {
      try {
        const cachedSession = localStorage.getItem(
          `pihole_session_${this.item.url}`,
        );
        if (cachedSession) {
          const session = JSON.parse(cachedSession);
          if (session.expiry > Date.now()) {
            this.sessionId = session.sid;
            this.sessionExpiry = session.expiry;
          } else {
            this.removeCacheSession();
          }
        }
      } catch (e) {
        console.error(`Failed to load cached session: ${e}`);
        this.removeCacheSession();
      }
    },
    removeCacheSession: function () {
      localStorage.removeItem(`pihole_session_${this.item.url}`);
      this.sessionId = null;
      this.sessionExpiry = null;
    },
    authenticate: async function () {
      const authResponse = await this.fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: this.item.apikey }),
      });

      if (!authResponse?.session?.sid) {
        throw new Error("Invalid authentication response");
      }

      this.sessionId = authResponse.session.sid;
      this.sessionExpiry = Date.now() + authResponse.session.validity * 1000;

      localStorage.setItem(
        `pihole_session_${this.item.url}`,
        JSON.stringify({
          sid: this.sessionId,
          expiry: this.sessionExpiry,
        }),
      );
    },
    fetchStatus: function () {
      return this.load(this.fetchStats());
    },
    fetchStats: async function () {
      if (!this.isAuthenticated && this.item.apikey) {
        await this.authenticate();
      }

      try {
        const [summary_response, status_response] = await Promise.all([
          this.fetch(
            `api/stats/summary?sid=${encodeURIComponent(this.sessionId)}`,
          ),
          this.fetch(
            `api/dns/blocking?sid=${encodeURIComponent(this.sessionId)}`,
          ),
        ]);

        if (
          summary_response?.queries?.percent_blocked === undefined ||
          status_response?.blocking === undefined
        ) {
          throw new Error("Invalid response format");
        }

        this.blocking = status_response.blocking;
        this.percent_blocked = summary_response.queries.percent_blocked;
        this.retryCount = 0;
      } catch (e) {
        const rejected = [401, 403].includes(e.cause?.status);
        if (rejected) {
          this.removeCacheSession();
        }
        if (rejected && this.item.apikey && this.retryCount < this.maxRetries) {
          this.retryCount++;
          await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
          return this.fetchStats();
        }
        throw e;
      }
    },
    fetchStatus_v5: function () {
      const authQueryParams = this.item.apikey
        ? `?summaryRaw&auth=${this.item.apikey}`
        : "";
      return this.load(
        this.fetch(`/api.php${authQueryParams}`).then((result) => {
          this.blocking = result.status;
          this.percent_blocked = result.ads_percentage_today;
        }),
      );
    },
  },
};
</script>

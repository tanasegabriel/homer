<template>
  <Generic :item="item" :subtitle="alerts" :status="status" />
</template>

<script>
import service from "@/mixins/service.js";
import { displayCount } from "@/utils/format.js";

const AlertsStatus = Object.freeze({
  firing: "firing",
  pending: "pending",
  inactive: "inactive",
});

const ALERT_STATE = {
  firing: "offline",
  pending: "warning",
  inactive: "online",
};

export default {
  name: "Prometheus",
  mixins: [service],
  data: () => ({
    serverError: null,
    api: {
      status: "",
      count: 0,
      alerts: {
        firing: 0,
        inactive: 0,
        pending: 0,
      },
    },
  }),
  computed: {
    alerts: function () {
      if (this.serverError !== false) {
        return null;
      }
      return displayCount(this.count, `${this.level} alert`);
    },
    count: function () {
      return (
        this.countFiring() || this.countPending() || this.countInactive() || 0
      );
    },
    level: function () {
      if (this.countFiring()) {
        return AlertsStatus.firing;
      } else if (this.countPending()) {
        return AlertsStatus.pending;
      }
      return AlertsStatus.inactive;
    },
    status: function () {
      if (this.serverError !== false) {
        return this.reachabilityStatus();
      }
      return this.api && { state: ALERT_STATE[this.level], label: this.count };
    },
  },
  methods: {
    fetchData: function () {
      return this.load(
        this.fetch("api/v1/alerts").then((api) => {
          this.api = api;
        }),
      );
    },
    countFiring: function () {
      if (this.api) {
        return this.api.data?.alerts?.filter(
          (alert) => alert.state === AlertsStatus.firing,
        ).length;
      }
      return 0;
    },
    countPending: function () {
      if (this.api) {
        return this.api.data?.alerts?.filter(
          (alert) => alert.state === AlertsStatus.pending,
        ).length;
      }
      return 0;
    },
    countInactive: function () {
      if (this.api) {
        return this.api.data?.alerts?.filter(
          (alert) => alert.state === AlertsStatus.inactive,
        ).length;
      }
      return 0;
    },
  },
};
</script>

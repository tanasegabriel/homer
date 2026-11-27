<template>
  <Generic :item="item" :title="serverError ? null : state" :status="status">
    <template v-if="!serverError" #subtitle>
      <template v-if="!error && display == 'text' && printing">
        <i class="fa-solid fa-gear mr-1"></i>
        <b v-if="completion">{{ displayPercent(completion, 0) }}</b>
        <span class="mx-1"> | </span>
        <span
          v-if="printTime"
          :title="`${displayDuration(printTimeLeft)} left`"
        >
          <i class="fa-solid fa-stopwatch mr-1"></i>
          {{ displayDuration(printTime) }}
        </span>
      </template>
      <template
        v-if="
          !error &&
          display == 'text' &&
          state == 'Operational' &&
          printer?.temperature
        "
      >
        <i class="fa-solid fa-temperature-half mr-1"></i>
        <b v-if="printer?.temperature?.bed">{{
          displayTemperature(printer.temperature.bed.actual, "°C", 0)
        }}</b>
        <span class="mx-1"> | </span>
        <b v-if="printer?.temperature?.tool0">{{
          displayTemperature(printer.temperature.tool0.actual, "°C", 0)
        }}</b>
      </template>
      <template v-if="!error && display == 'bar'">
        <progress
          v-if="completion"
          class="progress is-primary"
          :value="completion"
          max="100"
          :title="`${state} - ${displayPercent(completion, 0)}, ${displayDuration(
            printTimeLeft,
          )} left`"
        >
          {{ displayPercent(completion, 0) }}
        </progress>
      </template>
      <span v-if="error" :title="error">{{ error }}</span>
    </template>
  </Generic>
</template>

<script>
import service from "@/mixins/service.js";
import {
  displayDuration,
  displayPercent,
  displayTemperature,
} from "@/utils/format.js";

const PRINTER_STATE = {
  Operational: "online",
  Offline: "offline",
  Printing: "busy",
};

export default {
  name: "OctoPrint",
  mixins: [service],
  data: () => ({
    printTime: null,
    printTimeLeft: null,
    completion: null,
    state: null,
    printer: null,
    error: null,
    serverError: null,
  }),
  computed: {
    display: function () {
      return this.item.display == "bar" ? this.item.display : "text";
    },
    printing: function () {
      return this.state === "Printing";
    },
    status: function () {
      if (this.serverError || !this.state) {
        return this.reachabilityStatus();
      }
      return { state: PRINTER_STATE[this.state] ?? "warning", label: null };
    },
  },
  methods: {
    fetchData: async function () {
      await this.load(this.fetchStatus());
      if (this.serverError || this.state !== "Operational") {
        this.printer = null;
        return;
      }
      this.printer = await this.optional(
        this.fetch(`api/printer?apikey=${this.item.apikey}`),
      );
    },
    fetchStatus: async function () {
      const response = await this.fetch(`api/job?apikey=${this.item.apikey}`);
      this.printTime = response.progress.printTime;
      this.printTimeLeft = response.progress.printTimeLeft;
      this.completion = response.progress.completion;
      this.state = response.state;
      this.error = response.error;
    },
    displayDuration,
    displayPercent,
    displayTemperature,
  },
};
</script>

<style scoped lang="scss">
.progress {
  height: 8px;
  width: 90%;
}
</style>

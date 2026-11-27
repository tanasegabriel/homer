<template>
  <Generic :item="weatherItem" :badges="badges">
    <template v-if="icon && !serverError" #icon>
      <div class="card-icon" :class="item.background">
        <figure class="image">
          <img
            :src="`https://openweathermap.org/img/wn/${icon}@2x.png`"
            :alt="conditions"
            :title="conditions"
          />
        </figure>
      </div>
    </template>
    <template v-if="!serverError && temp !== null" #subtitle>
      <span>{{ temperature }}</span>
      <span class="location-time">{{ locationTime }}</span>
    </template>
  </Generic>
</template>

<script>
import service from "@/mixins/service.js";
import { displayTemperature } from "@/utils/format.js";

const CLOCK_TICK_MS = 15 * 1000;

// card-contract: off fetch -- a third-party public API, which must not receive the proxy or item headers
export default {
  name: "OpenWeather",
  mixins: [service],
  autoUpdate: false,
  data: () => ({
    id: null,
    icon: null,
    name: null,
    temp: null,
    conditions: null,
    timezoneOffset: 0,
    now: Date.now(),
    serverError: null,
  }),
  computed: {
    badges: function () {
      return [this.connectionBadge()];
    },
    weatherItem: function () {
      const item = { ...this.item };
      delete item.background;
      item.name = this.name ?? this.item.name;
      item.url = this.id ? `https://openweathermap.org/city/${this.id}` : "";
      return item;
    },
    temperature: function () {
      let unit = "K";
      if (this.item.units === "metric") {
        unit = "°C";
      } else if (this.item.units === "imperial") {
        unit = "°F";
      }
      return displayTemperature(this.temp, unit);
    },
    locationTime: function () {
      return this.calcTime(this.timezoneOffset, this.now);
    },
  },
  mounted() {
    this.clock = setInterval(() => {
      this.now = Date.now();
    }, CLOCK_TICK_MS);
  },
  beforeUnmount() {
    clearInterval(this.clock);
  },
  methods: {
    fetchData: function () {
      let locationQuery;

      // Use location ID if specified, otherwise retrieve value from location (name).
      if (this.item.locationId) {
        locationQuery = `id=${this.item.locationId}`;
      } else {
        locationQuery = `q=${this.item.location}`;
      }

      const apiKey = this.item.apikey || this.item.apiKey;

      let url = `https://api.openweathermap.org/data/2.5/weather?${locationQuery}&appid=${apiKey}&units=${this.item.units}`;
      if (this.item.endpoint) {
        url = this.item.endpoint;
      }

      return this.load(
        fetch(url)
          .then((response) => {
            if (!response.ok) {
              throw new Error(response.statusText);
            }
            return response.json();
          })
          .then((weather) => {
            this.id = weather.id;
            this.name = weather.name;
            this.temp = Number(weather.main.temp);
            this.icon = weather.weather[0].icon;
            this.conditions = weather.weather[0].description;
            this.timezoneOffset = weather.timezone;
          }),
      );
    },
    calcTime: (offset, now) => {
      const localTime = new Date(now);
      const utcTime =
        localTime.getTime() + localTime.getTimezoneOffset() * 60000;
      const calculatedTime = new Date(utcTime + 1000 * offset);
      return calculatedTime.toLocaleString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    },
  },
};
</script>

<style scoped lang="scss">
// Add a border around the weather image.
// Otherwise the image is not always distinguishable.
.card-icon {
  &.circle,
  &.square {
    background-color: #e4e4e4;
  }

  &.circle {
    border-radius: 90%;
  }
}

.dark .card-icon {
  &.circle,
  &.square {
    background-color: #909090;
  }
}

//Location Time
.location-time {
  margin-left: 20px;
}
</style>

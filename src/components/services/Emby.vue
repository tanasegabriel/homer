<template>
  <Generic :item="item" :subtitle="embyCount" :status="reachabilityStatus()" />
</template>

<script>
import service from "@/mixins/service.js";
import { displayCount } from "@/utils/format.js";

const LIBRARY_STATS = {
  music: (counts) =>
    `${displayCount(counts.SongCount, "song")}, ${displayCount(counts.AlbumCount, "album")}`,
  movies: (counts) => displayCount(counts.MovieCount, "movie"),
  series: (counts) =>
    `${displayCount(counts.EpisodeCount, "ep")}, ${displayCount(counts.SeriesCount, "series", "series")}`,
};

export default {
  name: "Emby",
  mixins: [service],
  data: () => ({
    counts: null,
    serverError: null,
  }),
  computed: {
    libraryTypes: function () {
      return [].concat(this.item.libraryType ?? []);
    },
    embyCount: function () {
      const types = this.libraryTypes;
      if (
        !types.length ||
        types.some((type) => !Object.hasOwn(LIBRARY_STATS, type))
      ) {
        return `wrong library type 💀`;
      }
      if (this.serverError || !this.counts) {
        return null;
      }
      return types.map((type) => LIBRARY_STATS[type](this.counts)).join(", ");
    },
  },
  methods: {
    fetchData: function () {
      return this.load(
        this.fetch("/System/info/public").then((info) => {
          if (!info?.Id) {
            throw new Error("Unexpected answer from /System/info/public");
          }
          if (this.item.subtitle) {
            return;
          }
          return this.fetch("/items/counts", {
            headers: this.authHeaders(info),
          }).then((counts) => {
            this.counts = counts;
          });
        }),
      );
    },
    // Jellyfin 12 no longer accepts X-Emby-Token.
    authHeaders: function (serverInfo) {
      const isJellyfin12OrNewer =
        serverInfo?.ProductName?.toLowerCase().includes("jellyfin") &&
        parseInt(serverInfo.Version, 10) >= 12;

      const legacyAuth = this.item.legacyAuth ?? !isJellyfin12OrNewer;

      return legacyAuth
        ? { "X-Emby-Token": this.item.apikey }
        : { Authorization: `MediaBrowser Token="${this.item.apikey}"` };
    },
  },
};
</script>

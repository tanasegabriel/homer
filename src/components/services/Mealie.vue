<template>
  <Generic :item="item" :subtitle="mealtext || statsText" :badges="badges" />
</template>

<script>
import service from "@/mixins/service.js";
import { displayCount } from "@/utils/format.js";

export default {
  name: "Mealie",
  mixins: [service],
  data: () => ({
    stats: null,
    meal: null,
    serverError: null,
  }),
  computed: {
    badges() {
      return [this.connectionBadge()];
    },
    mealtext: function () {
      const name = this.meal?.[0]?.recipe?.name ?? this.meal?.[0]?.title;
      if (!this.serverError && name) {
        return `Today: ${name}`;
      }
      return null;
    },
    statsText: function () {
      if (!this.serverError && this.stats) {
        return `Happily keeping ${displayCount(this.stats.totalRecipes, "recipe")} organized`;
      }
      return null;
    },
  },
  methods: {
    fetchData: async function () {
      const headers = {
        Authorization: "Bearer " + this.item.apikey,
        Accept: "application/json",
      };

      const requests = [
        this.fetch("/api/groups/mealplans/today", { headers }).then((meal) => {
          this.meal = meal;
        }),
      ];
      if (!this.item.subtitle) {
        // Admin-only, so a non-admin key must not sink the whole card.
        requests.push(
          this.optional(
            this.fetch("/api/admin/about/statistics", { headers }),
          ).then((stats) => {
            this.stats = stats;
          }),
        );
      }
      return this.load(...requests);
    },
  },
};
</script>

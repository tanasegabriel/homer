<template>
  <Generic
    v-if="serverError && !bookmarks.length"
    v-bind="$attrs"
    :item="item"
    :status="reachabilityStatus()"
  />
  <template v-else>
    <Generic
      v-for="bookmark in bookmarks"
      :key="bookmark.url"
      v-bind="$attrs"
      :item="bookmark"
    />
  </template>
</template>

<script>
import service from "@/mixins/service.js";

const SHARED_OPTIONS = ["target", "tagstyle", "background"];

// card-contract: off structure -- one card per bookmark, each given the classes Homer puts on the card through $attrs
export default {
  name: "Linkding",
  mixins: [service],
  inheritAttrs: false,
  data: () => ({
    bookmarks: [],
    serverError: null,
  }),
  computed: {
    calculatedLimit: function () {
      const limit = parseInt(this.item.limit) || 5;
      return Math.min(Math.max(limit, 1), 15);
    },
  },
  methods: {
    fetchData: function () {
      const headers = {
        Authorization: `Token ${this.item.token}`,
        Accept: "application/json",
      };
      const query = this.item.query
        ? `&q=${encodeURIComponent(this.item.query)}`
        : "";

      return this.load(
        this.fetch(`/api/bookmarks/?limit=${this.calculatedLimit}${query}`, {
          headers,
        }).then((response) => {
          this.bookmarks = response.results.map(this.bookmarkItem);
        }),
      );
    },
    bookmarkItem: function (bookmark) {
      const shared = Object.fromEntries(
        SHARED_OPTIONS.map((key) => [key, this.item[key]]),
      );
      return {
        ...shared,
        name: bookmark.title || bookmark.website_title || bookmark.url,
        subtitle: bookmark.description || bookmark.website_description,
        url: bookmark.url,
        logo: bookmark.favicon_url || this.item.logo,
        icon: bookmark.favicon_url ? undefined : this.item.icon,
        tag: bookmark.tag_names.join(" #"),
      };
    },
  },
};
</script>

<template>
  <div v-if="show" class="block" :class="{ 'is-contained': contained }">
    <article class="message" :class="message.style">
      <div v-if="message.title || message.icon" class="message-header">
        <p>
          <i v-if="message.icon" :class="`fa-fw ${message.icon}`"></i>
          {{ message.title }}
        </p>
      </div>
      <div
        v-if="message.content"
        class="message-body"
        v-html="message.content"
      ></div>
    </article>
  </div>
</template>

<script>
import fetchOptions from "@/utils/fetchOptions.js";
import sanitizeHtml from "@/utils/sanitizeHtml.js";

export default {
  name: "Message",
  props: {
    item: Object,
  },
  data: function () {
    return {
      message: {},
      refreshTimer: null,
    };
  },
  computed: {
    show: function () {
      return this.message.title || this.message.content;
    },
    contained: function () {
      return this.item?.url && this.item.sanitize !== false;
    },
  },
  watch: {
    item: {
      immediate: true,
      // A page switch rebuilds the config and replaces this prop, so the
      // endpoint has to be queried again, not just reset to the config value.
      handler: function (item) {
        clearInterval(this.refreshTimer);
        this.message = { ...item };
        this.getMessage();

        if (item?.url && item.refreshInterval) {
          this.refreshTimer = setInterval(
            this.getMessage,
            item.refreshInterval,
          );
        }
      },
    },
  },
  beforeUnmount: function () {
    clearInterval(this.refreshTimer);
  },
  methods: {
    getMessage: async function () {
      const item = this.item;
      if (!item?.url) {
        return;
      }

      let fetchedMessage = await this.downloadMessage(item.url);

      // A page switch during the fetch makes this response obsolete.
      if (item !== this.item) {
        return;
      }

      if (item.mapping) {
        fetchedMessage = this.mapRemoteMessage(fetchedMessage);
      }

      if (fetchedMessage.content && item.sanitize !== false) {
        const { html, removed } = sanitizeHtml(fetchedMessage.content);
        fetchedMessage.content = html || null;
        if (removed.length) {
          console.warn(
            `XSS protection removed potentially unsafe HTML from the message at ${item.url}:`,
            removed.join(", "),
          );
        }
      }

      // keep the original config value if no value is provided by the endpoint
      for (const prop of ["title", "style", "content", "icon"]) {
        if (prop in fetchedMessage && fetchedMessage[prop] !== null) {
          this.message[prop] = fetchedMessage[prop];
        }
      }
    },

    // Never rejects, so a failing endpoint cannot break the refresh loop.
    downloadMessage: async function (url) {
      try {
        const response = await fetch(
          url,
          fetchOptions({
            item: this.item,
            init: { headers: { Accept: "application/json" } },
          }),
        );

        if (!response.ok) {
          throw new Error(`${response.status} error`);
        }

        const message = await response.json();
        return message instanceof Object ? message : {};
      } catch (error) {
        console.warn(`Failed to fetch message from ${url}:`, error);
        return {};
      }
    },

    mapRemoteMessage: function (message) {
      let mapped = {};
      // map property from message into mapped according to mapping config (only if field has a value):
      for (const prop in this.item.mapping)
        if (message[this.item.mapping[prop]])
          mapped[prop] = message[this.item.mapping[prop]];
      return mapped;
    },
  },
};
</script>

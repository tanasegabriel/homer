<template>
  <Generic :item="item" :badges="badges">
    <template v-if="serverError === false" #subtitle>
      <div
        class="metrics"
        :class="{
          'is-size-7-mobile': item.small_font_on_small_screens,
          'is-small': item.small_font_on_desktop,
        }"
      >
        <span v-if="isValueShown('vms') && vms" class="margined"
          >VMs:
          <span class="is-number"
            ><span class="has-text-weight-bold">{{ vms.running }}</span
            ><span v-if="isValueShown('vms_total')"
              >/{{ vms.total }}</span
            ></span
          ></span
        >
        <span v-if="isValueShown('lxcs') && lxcs?.total" class="margined"
          >LXCs:
          <span class="is-number"
            ><span class="has-text-weight-bold">{{ lxcs.running }}</span
            ><span v-if="isValueShown('lxcs_total')"
              >/{{ lxcs.total }}</span
            ></span
          ></span
        >
        <span v-if="isValueShown('disk')" class="margined"
          >Disk:
          <span
            class="has-text-weight-bold is-number"
            :class="statusClass(diskUsed)"
            >{{ displayPercent(diskUsed, decimals) }}</span
          ></span
        >
        <span v-if="isValueShown('mem')" class="margined"
          >Mem:
          <span
            class="has-text-weight-bold is-number"
            :class="statusClass(memoryUsed)"
            >{{ displayPercent(memoryUsed, decimals) }}</span
          ></span
        >
        <span v-if="isValueShown('cpu')" class="margined"
          >CPU:
          <span
            class="has-text-weight-bold is-number"
            :class="statusClass(cpuUsed)"
            >{{ displayPercent(cpuUsed, decimals) }}</span
          ></span
        >
      </div>
    </template>
  </Generic>
</template>

<script>
import service from "@/mixins/service.js";
import { displayPercent } from "@/utils/format.js";

export default {
  name: "Proxmox",
  mixins: [service],
  data: () => ({
    vms: null,
    lxcs: null,
    memoryUsed: 0,
    diskUsed: 0,
    cpuUsed: 0,
    serverError: null,
  }),
  computed: {
    badges() {
      return [this.connectionBadge()];
    },
    options() {
      return { headers: { Authorization: this.item.api_token } };
    },
    decimals() {
      return this.item.hide_decimals ? 0 : 1;
    },
  },
  methods: {
    displayPercent,
    statusClass(value) {
      const shown = Number(value.toFixed(this.decimals));
      if (shown > this.item.danger_value) return "danger";
      if (shown > this.item.warning_value) return "warning";
      return "healthy";
    },
    fetchData: async function () {
      await this.load(this.fetchNode());
      if (!this.serverError) {
        await Promise.all([
          this.fetchGuests("vms", "qemu"),
          this.fetchGuests("lxcs", "lxc"),
        ]);
      }
    },
    fetchNode: async function () {
      const status = await this.fetch(
        `/api2/json/nodes/${this.item.node}/status`,
        this.options,
      );
      this.memoryUsed =
        (status.data.memory.used * 100) / status.data.memory.total;
      this.diskUsed =
        (status.data.rootfs.used * 100) / status.data.rootfs.total;
      this.cpuUsed = status.data.cpu * 100;
    },
    fetchGuests: async function (key, type) {
      if (!this.isValueShown(key)) {
        return;
      }
      const guests = await this.optional(
        this.fetch(`/api2/json/nodes/${this.item.node}/${type}`, this.options),
      );
      const list = guests?.data ?? [];
      this[key] = guests && {
        total: list.length,
        running: list.filter((guest) => guest.status === "running").length,
      };
    },
  },
};
</script>

<style scoped lang="scss">
.healthy {
  color: var(--status-online);
}
.warning {
  color: var(--status-warning);
}
.danger {
  color: var(--status-offline);
}
.metrics .margined:not(:first-child) {
  margin-left: 0.3rem;
}
.is-small {
  font-size: small;
}
</style>

#include <bits/stdc++.h>

#include <bits/stdc++.h>
using namespace std;

using ll = long long;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int t;
    cin >> t;

    while (t--) {
        int n, k;
        cin >> n >> k;

        vector<vector<int>> g(n + 1);

        for (int i = 0; i < n - 1; i++) {
            int u, v;
            cin >> u >> v;
            g[u].push_back(v);
            g[v].push_back(u);
        }

        // Build parent and traversal order from node 1
        vector<int> parent(n + 1, 0);
        vector<int> order;
        order.reserve(n);

        stack<int> st;
        st.push(1);
        parent[1] = -1;

        while (!st.empty()) {
            int u = st.top();
            st.pop();
            order.push_back(u);

            for (int v : g[u]) {
                if (v == parent[u]) continue;
                parent[v] = u;
                st.push(v);
            }
        }

        // Compute subtree sizes
        vector<int> sub(n + 1, 1);
        for (int i = (int)order.size() - 1; i >= 0; i--) {
            int u = order[i];
            for (int v : g[u]) {
                if (v == parent[u]) continue;
                sub[u] += sub[v];
            }
        }

        ll answer = n;  
        // Each node contributes once when the root is itself

        for (int x = 1; x <= n; x++) {
            // Check the component on the parent side
            if (x != 1) {
                int parentSide = n - sub[x];
                if (parentSide <= n - k) {
                    answer += parentSide;
                }
            }

            // Check each child-side component
            for (int v : g[x]) {
                if (v == parent[x]) continue;
                int childSide = sub[v];
                if (childSide <= n - k) {
                    answer += childSide;
                }
            }
        }

        cout << answer << '\n';
    }

    return 0;
}

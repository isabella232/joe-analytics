import {
  AppShell,
  KPI,
  Link,
  Loading,
  PageHeader,
  PairIcon,
} from "app/components";
import {
  Avatar,
  Box,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  makeStyles,
} from "@material-ui/core";
import {
  barUserQuery,
  blockQuery,
  currencyFormatter,
  decimalFormatter,
  avaxPriceQuery,
  formatCurrency,
  getApollo,
  getBarUser,
  getAvaxPrice,
  getLatestBlock,
  getPairs,
  getPoolUser,
  getJoeToken,
  getToken,
  getUser,
  getUsers,
  latestBlockQuery,
  lockupUserQuery,
  pairSubsetQuery,
  pairsQuery,
  poolUserQuery,
  tokenQuery,
  useInterval,
  userIdsQuery,
  userQuery,
} from "app/core";
import { getUnixTime, startOfMinute, startOfSecond } from "date-fns";

import { AvatarGroup } from "@material-ui/lab";
import Head from "next/head";
import { toChecksumAddress } from "web3-utils";
import { useQuery } from "@apollo/client";
import { useRouter } from "next/router";

const useStyles = makeStyles((theme) => ({
  root: {},
  title: {
    fontSize: 14,
  },
  avatar: {
    marginRight: theme.spacing(1),
  },
  paper: {
    padding: theme.spacing(2),
  },
}));

function UserPage() {
  const router = useRouter();

  if (router.isFallback) {
    return <Loading />;
  }
  const classes = useStyles();

  const id =
    router && router.query && router.query.id && router.query.id.toLowerCase();

  const {
    data: { bundles },
  } = useQuery(avaxPriceQuery, {
    pollInterval: 60000,
  });

  const { data: barData } = useQuery(barUserQuery, {
    variables: {
      id: id.toLowerCase(),
    },
    context: {
      clientName: "bar",
    },
  });

  const { data: poolData } = useQuery(poolUserQuery, {
    variables: {
      address: id.toLowerCase(),
    },
    context: {
      clientName: "masterchef",
    },
  });

  const {
    data: { token },
  } = useQuery(tokenQuery, {
    variables: {
      id: "0x6e84a6216ea6dacc71ee8e6b0a5b7322eebc0fdd",
    },
  });

  const {
    data: { pairs },
  } = useQuery(pairsQuery);

  const poolUsers = poolData.users.filter(
    (user) =>
      user.pool &&
      user.pool.allocPoint !== "0" &&
      pairs.find((pair) => pair?.id === user.pool.pair)
  );

  // useInterval(
  //   () =>
  //     Promise.all([
  //       getPairs,
  //       getJoeToken,
  //       getPoolUser(id.toLowerCase()),
  //       getBarUser(id.toLocaleLowerCase()),
  //       getAvaxPrice,
  //     ]),
  //   60000
  // );

  const joePrice =
    parseFloat(token?.derivedAVAX) * parseFloat(bundles[0].avaxPrice);

  // BAR
  const xJoe = parseFloat(barData?.user?.xJoe);

  const barPending =
    (xJoe * parseFloat(barData?.user?.bar?.joeStaked)) /
    parseFloat(barData?.user?.bar?.totalSupply);

  const xJoeTransfered =
    barData?.user?.xJoeIn > barData?.user?.xJoeOut
      ? parseFloat(barData?.user?.xJoeIn) - parseFloat(barData?.user?.xJoeOut)
      : parseFloat(barData?.user?.xJoeOut) - parseFloat(barData?.user?.xJoeIn);

  const barStaked = barData?.user?.joeStaked;

  const barStakedUSD = barData?.user?.joeStakedUSD;

  const barHarvested = barData?.user?.joeHarvested;
  const barHarvestedUSD = barData?.user?.joeHarvestedUSD;

  const barPendingUSD = barPending > 0 ? barPending * joePrice : 0;

  const barRoiJoe =
    barPending -
    (parseFloat(barData?.user?.joeStaked) -
      parseFloat(barData?.user?.joeHarvested) +
      parseFloat(barData?.user?.joeIn) -
      parseFloat(barData?.user?.joeOut));

  const barRoiUSD =
    barPendingUSD -
    (parseFloat(barData?.user?.joeStakedUSD) -
      parseFloat(barData?.user?.joeHarvestedUSD) +
      parseFloat(barData?.user?.usdIn) -
      parseFloat(barData?.user?.usdOut));

  const { data: blocksData } = useQuery(latestBlockQuery, {
    context: {
      clientName: "blocklytics",
    },
  });

  const blockDifference =
    parseInt(blocksData?.blocks[0].number) - parseInt(barData?.user?.updatedAt);

  const barRoiDailyJoe = (barRoiJoe / blockDifference) * 6440;

  // POOLS

  const poolsUSD = poolUsers?.reduce((previousValue, currentValue) => {
    const pair = pairs.find((pair) => pair.id == currentValue?.pool?.pair);
    if (!pair) {
      return previousValue;
    }
    const share = Number(currentValue.amount / 1e18) / pair.totalSupply;
    return previousValue + pair.reserveUSD * share;
  }, 0);

  const poolsPendingUSD =
    poolUsers?.reduce((previousValue, currentValue) => {
      return (
        previousValue +
        ((currentValue.amount * currentValue.pool.accJoePerShare) / 1e12 -
          currentValue.rewardDebt) /
          1e18
      );
    }, 0) * joePrice;

  const [poolEntriesUSD, poolExitsUSD, poolHarvestedUSD] =
    poolData?.users.reduce(
      (previousValue, currentValue) => {
        const [entries, exits, harvested] = previousValue;
        return [
          entries + parseFloat(currentValue.entryUSD),
          exits + parseFloat(currentValue.exitUSD),
          harvested + parseFloat(currentValue.joeHarvestedUSD),
        ];
      },
      [0, 0, 0]
    );

  // Global

  // const originalInvestments =
  //   parseFloat(barData?.user?.joeStakedUSD) + parseFloat(poolEntriesUSD);

  const investments =
    poolEntriesUSD + barPendingUSD + poolsPendingUSD + poolExitsUSD;

  return (
    <AppShell>
      <Head>
        <title>User {id} | JoeSwap Analytics</title>
      </Head>

      <PageHeader>
        <Typography variant="h5" component="h1" gutterBottom noWrap>
          Portfolio {id}
        </Typography>
      </PageHeader>

      <Typography
        variant="h6"
        component="h2"
        color="textSecondary"
        gutterBottom
      >
        Bar
      </Typography>

      {!barData?.user?.bar ? (
        <Box mb={4}>
          <Typography>Address isn't in the bar...</Typography>
        </Box>
      ) : (
        <>
          <Box mb={4}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <KPI
                  title="Value"
                  value={formatCurrency(joePrice * barPending)}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <KPI title="Invested" value={formatCurrency(barStakedUSD)} />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <KPI
                  title="xJOE"
                  value={Number(xJoe.toFixed(2)).toLocaleString()}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <KPI title="Profit/Loss" value={formatCurrency(barRoiUSD)} />
              </Grid>
            </Grid>
          </Box>

          <Box my={4}>
            <TableContainer variant="outlined">
              <Table aria-label="farming">
                <TableHead>
                  <TableRow>
                    <TableCell key="token">Token</TableCell>
                    <TableCell key="staked" align="right">
                      Deposited
                    </TableCell>
                    <TableCell key="harvested" align="right">
                      Withdrawn
                    </TableCell>
                    <TableCell key="pending" align="right">
                      Pending
                    </TableCell>
                    <TableCell key="barRoiYearly" align="right">
                      ROI (Yearly)
                    </TableCell>
                    <TableCell key="barRoiMonthly" align="right">
                      ROI (Monthly)
                    </TableCell>
                    <TableCell key="barRoiDaily" align="right">
                      ROI (Daily)
                    </TableCell>
                    <TableCell key="barRoiJoe" align="right">
                      ROI (All-time)
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow key="12">
                    <TableCell component="th" scope="row">
                      <Box display="flex" alignItems="center">
                        <Avatar
                          className={classes.avatar}
                          imgProps={{ loading: "lazy" }}
                          alt="JOE"
                          src={`https://raw.githubusercontent.com/traderjoe-xyz/joe-tokenlists/main/logos/${toChecksumAddress(
                            "0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd"
                          )}/logo.png`}
                        />
                        <Link
                          href={`/tokens/0x6e84a6216ea6dacc71ee8e6b0a5b7322eebc0fdd`}
                          variant="body2"
                          noWrap
                        >
                          JOE
                        </Link>
                        {/* <Link href={`/tokens/0x8798249c2e607446efb7ad49ec89dd1865ff4272`} variant="body2" noWrap>
                        xJOE
                      </Link> */}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography noWrap variant="body2">
                        {decimalFormatter.format(barStaked)} (
                        {formatCurrency(barStakedUSD)})
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography noWrap variant="body2">
                        {decimalFormatter.format(barHarvested)} (
                        {formatCurrency(barHarvestedUSD)})
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography noWrap variant="body2">
                        {Number(barPending.toFixed(2)).toLocaleString()} (
                        {formatCurrency(joePrice * barPending)})
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography noWrap variant="body2">
                        {decimalFormatter.format(barRoiDailyJoe * 365)} (
                        {formatCurrency(barRoiDailyJoe * 365 * joePrice)})
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography noWrap variant="body2">
                        {decimalFormatter.format(barRoiDailyJoe * 30)} (
                        {formatCurrency(barRoiDailyJoe * 30 * joePrice)})
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography noWrap variant="body2">
                        {decimalFormatter.format(barRoiDailyJoe)} (
                        {formatCurrency(barRoiDailyJoe * joePrice)})
                      </Typography>
                    </TableCell>

                    <TableCell align="right">
                      {decimalFormatter.format(barRoiJoe)} (
                      {formatCurrency(barRoiJoe * joePrice)})
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </>
      )}

      <Typography
        variant="h6"
        component="h2"
        color="textSecondary"
        gutterBottom
      >
        Pools
      </Typography>

      {!poolData?.users.length ? (
        <Typography>Address isn't farming...</Typography>
      ) : (
        <>
          <Box mb={4}>
            <Grid container spacing={2}>
              <Grid item xs>
                <KPI
                  title="Value"
                  value={formatCurrency(poolsUSD + poolsPendingUSD)}
                />
              </Grid>
              <Grid item xs>
                <KPI title="Invested" value={formatCurrency(poolEntriesUSD)} />
              </Grid>
              <Grid item xs>
                <KPI
                  title="Profit/Loss"
                  value={formatCurrency(
                    poolsUSD +
                      poolExitsUSD +
                      poolHarvestedUSD +
                      poolsPendingUSD -
                      poolEntriesUSD
                  )}
                />
              </Grid>
            </Grid>
          </Box>

          <Box my={4}>
            <TableContainer variant="outlined">
              <Table aria-label="farming">
                <TableHead>
                  <TableRow>
                    <TableCell key="pool">Pool</TableCell>
                    <TableCell key="jlp" align="right">
                      JLP
                    </TableCell>
                    <TableCell key="entryUSD" align="right">
                      Deposited
                    </TableCell>
                    <TableCell key="exitUSD" align="right">
                      Withdrawn
                    </TableCell>
                    <TableCell key="balance" align="right">
                      Balance
                    </TableCell>
                    <TableCell key="value" align="right">
                      Value
                    </TableCell>
                    <TableCell key="pendingJoe" align="right">
                      Joe Pending
                    </TableCell>
                    <TableCell key="joeHarvested" align="right">
                      Joe Harvested
                    </TableCell>
                    <TableCell key="pl" align="right">
                      Profit/Loss
                    </TableCell>
                    {/* <TableCell key="apy" align="right">
                      APY
                    </TableCell> */}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {poolUsers.map((user) => {
                    const pair = pairs.find(
                      (pair) => pair.id == user.pool.pair
                    );
                    const jlp = Number(user.amount / 1e18);

                    const share = jlp / pair.totalSupply;

                    const token0 = pair.reserve0 * share;
                    const token1 = pair.reserve1 * share;

                    const pendingJoe =
                      ((user.amount * user.pool.accJoePerShare) / 1e12 -
                        user.rewardDebt) /
                      1e18;

                    return (
                      <TableRow key={user.pool.id}>
                        <TableCell component="th" scope="row">
                          <Box display="flex" alignItems="center">
                            <PairIcon
                              base={pair.token0.id}
                              quote={pair.token1.id}
                            />
                            <Link
                              href={`/pools/${user.pool.id}`}
                              variant="body2"
                              noWrap
                            >
                              {pair.token0.symbol}-{pair.token1.symbol}
                            </Link>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Typography noWrap variant="body2">
                            {decimalFormatter.format(jlp)} JLP
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography noWrap variant="body2">
                            {currencyFormatter.format(user.entryUSD)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography noWrap variant="body2">
                            {currencyFormatter.format(user.exitUSD)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography noWrap variant="body2">
                            {decimalFormatter.format(token0)}{" "}
                            {pair.token0.symbol} +{" "}
                            {decimalFormatter.format(token1)}{" "}
                            {pair.token1.symbol}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography noWrap variant="body2">
                            {currencyFormatter.format(pair.reserveUSD * share)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography noWrap variant="body2">
                            {decimalFormatter.format(pendingJoe)} (
                            {currencyFormatter.format(pendingJoe * joePrice)})
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography noWrap variant="body2">
                            {decimalFormatter.format(user.joeHarvested)} (
                            {currencyFormatter.format(user.joeHarvestedUSD)})
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography noWrap variant="body2">
                            {currencyFormatter.format(
                              parseFloat(pair.reserveUSD * share) +
                                parseFloat(user.exitUSD) +
                                parseFloat(user.joeHarvestedUSD) +
                                parseFloat(pendingJoe * joePrice) -
                                parseFloat(user.entryUSD)
                            )}
                          </Typography>
                        </TableCell>
                        {/* <TableCell align="right">23.76%</TableCell> */}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </>
      )}
    </AppShell>
  );
}

export async function getStaticProps({ params }) {
  const client = getApollo();

  const id = params.id.toLowerCase();

  await getAvaxPrice(client);

  await getJoeToken(client);

  await getBarUser(id.toLowerCase(), client);

  await getPoolUser(id.toLowerCase(), client);

  await getPairs(client);

  await getLatestBlock(client);

  await getUser(id, client)

  await getUsers(client)

  return {
    props: {
      initialApolloState: client.cache.extract(),
    },
    revalidate: 1,
  };
}

export async function getStaticPaths() {
  const client = getApollo();

  const { data: { users } } = await client.query({
    query: userIdsQuery,
  });

  const paths = users.map(user => ({
    params: { id: user.id }
  }));

  return { paths, fallback: false };
}

export default UserPage;

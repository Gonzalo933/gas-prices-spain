#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Created on Wed Jun  7 15:09:54 2017

@author: gonzalo Hernandez
"""

import sqlite3
from sqlite3 import Error
import datetime
import matplotlib.pyplot as plt
import seaborn as sns
import matplotlib.dates as md
import pandas as pd
from pandas import DataFrame, Series
import statsmodels.formula.api as sm
import numpy as np

from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, WhiteKernel

df = pd.read_csv('data.csv')

df.drop('new_diesel_price', axis=1, inplace=True)
df.dropna(axis=0, how='any', inplace=True)
df['date'] = pd.to_datetime(df['date'], unit='s')
df['date_delta'] =  (df['date'] - df['date'].min()) / np.timedelta64(1,'D')

df = df.sample(n=3000)
df.plot(x='date_delta', y='diesel_price', style='o')

train, validate, test = np.split(df.sample(frac=1), [int(.6*len(df)), int(.8*len(df))])

kernel = 1.0 * RBF(length_scale=100.0, length_scale_bounds=(1e-2, 1e3))
gp = GaussianProcessRegressor(kernel=kernel,
				  alpha=0.0).fit(
				  train['date_delta'].values.reshape(-1,1),
				  train['diesel_price'].values.reshape(-1,1))


def create_connection(db_file):
	""" create a database connection to the SQLite database
		specified by the db_file
	:param db_file: database file
	:return: Connection object or None
	"""
	try:
		conn = sqlite3.connect(db_file)
		return conn
	except Error as e:
		print(e)

	return None


def get_data_from_db(conn):
	cur = conn.cursor()
	cur.execute("""SELECT date, diesel_price
					FROM gas_data
					""")

	rows = cur.fetchall()
	return list(map(lambda x: [x[0], date_to_time(x[0]), x[1]], rows))


def date_to_time(unix):
	return datetime.datetime.fromtimestamp(int(unix))#.strftime('%Y/%m/%d')


def draw_graph(rows):
	ax=plt.gca()
	xfmt = md.DateFormatter('%d/%m')
	ax.xaxis.set_major_formatter(xfmt)
	dates = md.date2num([r[1] for r in rows]) # x axis
	values = [r[2] for r in rows]
	print(len(dates))
	plt.plot(dates, values, color='red', linestyle='None', marker='o', label='prices €')
	plt.savefig('Prices_history.png')

def main():
	database = "gas_prices.db"
	# create a database connection
	conn = create_connection(database)
	with conn:
		rows = get_data_from_db(conn)
	draw_graph(rows)

#if __name__ == '__main__':
	#main()